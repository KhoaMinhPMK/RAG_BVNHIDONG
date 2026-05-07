import { supabase } from '../lib/supabase/client.js';
// DON'T import ollamaClient at top-level - lazy import when needed
// Lazy import embeddingClient when needed
import { llmChat, type LLMProvider } from '../lib/llm/unified.js';
import { logger } from '../lib/utils/logger.js';
import type { Citation } from '../types/api.js';
import {
  detectKnowledgeAnswerStatus,
  rankKnowledgeDocuments,
  type KnowledgeDocument,
} from './knowledge-ranking.js';

interface KnowledgeAgentRequest {
  query: string;
  role: string;
  episode_id?: string;
  max_results?: number;
  provider?: LLMProvider;
}

interface KnowledgeAgentResponse {
  answer: string;
  citations: Citation[];
  model_version: string;
  timestamp: string;
  uncertainty?: number;
  status: 'success' | 'insufficient_evidence' | 'out_of_scope';
}

interface VectorSearchMatch {
  document_id: string;
  content: string;
  similarity: number;
  document_title: string;
  document_version: string;
  effective_date: string;
}

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFC');
}

export function extractFallbackSearchTerms(
  query: string,
  stopWords: Set<string>
): string[] {
  const terms = query
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 4 && !stopWords.has(term));

  const expandedTerms = terms.flatMap((term) => {
    const asciiTerm = stripDiacritics(term);
    return asciiTerm !== term ? [term, asciiTerm] : [term];
  });

  return Array.from(new Set(expandedTerms)).slice(0, 8);
}

function normalizeQueryTerm(term: string): string {
  return stripDiacritics(term.toLowerCase());
}

function annotateLexicalSignals(
  title: string,
  content: string,
  searchTerms: string[]
): Pick<KnowledgeDocument, 'lexical_score' | 'matched_terms'> {
  if (searchTerms.length === 0) {
    return {
      lexical_score: 0,
      matched_terms: [],
    };
  }

  const normalizedHaystack = `${normalizeQueryTerm(title)}\n${normalizeQueryTerm(content)}`;
  const matchedTerms = Array.from(
    new Set(
      searchTerms.filter((term) => normalizedHaystack.includes(normalizeQueryTerm(term)))
    )
  );

  return {
    lexical_score: matchedTerms.length / searchTerms.length,
    matched_terms: matchedTerms,
  };
}

/**
 * Knowledge Agent - RAG retrieval for guideline/SOP queries
 * Latency target: < 3s
 */
export class KnowledgeAgent {
  private readonly fallbackStopWords = new Set([
    'what',
    'when',
    'where',
    'which',
    'with',
    'without',
    'about',
    'into',
    'from',
    'that',
    'this',
    'these',
    'those',
    'have',
    'has',
    'how',
    'for',
    'the',
    'and',
    'are',
    'children',
  ]);

  private readonly systemPrompt = `Bạn là trợ lý y tế chuyên về viêm phổi Nhi khoa.
Nhiệm vụ: Trả lời câu hỏi dựa HOÀN TOÀN trên tài liệu được cung cấp.

QUY TẮC BẮT BUỘC:
1. CHỈ trả lời dựa trên tài liệu được cung cấp
2. KHÔNG tự suy diễn hoặc thêm thông tin ngoài tài liệu
3. Nếu không đủ bằng chứng → trả lời "INSUFFICIENT_EVIDENCE"
4. Nếu câu hỏi ngoài phạm vi y tế Nhi khoa → trả lời "OUT_OF_SCOPE"
5. Trích dẫn rõ nguồn bằng cách ghi [Tài liệu X]
6. Trả lời ngắn gọn, rõ ràng, chuyên nghiệp
7. TUYỆT ĐỐI KHÔNG dùng emoji hoặc Unicode pictogram. Giữ nguyên tiếng Việt có dấu đầy đủ.

Định dạng trả lời:
- Câu trả lời chính
- Trích dẫn: [Tài liệu 1], [Tài liệu 2]...`;

  /**
   * Generate embedding for query text
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    const { embeddingClient } = await import('../lib/embedding/client.js');
    const result = await embeddingClient.generateEmbedding(query);
    return result.embedding;
  }

  /**
   * Retrieve relevant chunks using vector similarity search
   * Falls back to text search if vector search fails
   */
  private async retrieveDocuments(
    query: string,
    maxResults: number = 5
  ): Promise<KnowledgeDocument[]> {
    const rawMatchCount = Math.max(maxResults * 5, maxResults);

    try {
      const [vectorMatches, lexicalMatches] = await Promise.all([
        this.retrieveVectorMatches(query, rawMatchCount),
        this.retrieveLexicalMatches(query, rawMatchCount),
      ]);

      const combinedMatches = [...vectorMatches, ...lexicalMatches];

      if (combinedMatches.length === 0) {
        logger.warn('No hybrid retrieval results', { query });
        return [];
      }

      const rankedDocuments = rankKnowledgeDocuments(query, combinedMatches, maxResults);

      logger.info('Hybrid retrieval results', {
        vectorCandidates: vectorMatches.length,
        lexicalCandidates: lexicalMatches.length,
        combinedCandidates: combinedMatches.length,
        uniqueDocuments: rankedDocuments.length,
        query,
      });

      return rankedDocuments;
    } catch (err) {
      logger.error('Document retrieval exception', { error: err });
      return this.retrieveLexicalMatches(query, rawMatchCount).then((matches) =>
        rankKnowledgeDocuments(query, matches, maxResults)
      );
    }
  }

  /**
   * Dense retrieval using vector similarity search
   */
  private async retrieveVectorMatches(
    query: string,
    maxResults: number
  ): Promise<KnowledgeDocument[]> {
    try {
      const queryEmbedding = await this.generateQueryEmbedding(query);
      const searchTerms = this.extractFallbackTerms(query);

      const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: maxResults,
      });

      if (error) {
        logger.warn('Vector search failed, continuing with lexical retrieval', {
          error: error.message,
        });
        return [];
      }

      return ((data as VectorSearchMatch[] | null) ?? []).map((chunk) => ({
        document_id: chunk.document_id,
        title: chunk.document_title || 'Unknown',
        version: chunk.document_version || 'v1.0',
        content: chunk.content,
        effective_date: chunk.effective_date || '',
        status: 'active',
        similarity: chunk.similarity,
        ...annotateLexicalSignals(
          chunk.document_title || 'Unknown',
          chunk.content,
          searchTerms
        ),
      }));
    } catch (err) {
      logger.error('Vector retrieval exception', { error: err });
      return [];
    }
  }

  /**
   * Lexical retrieval used as a hybrid signal and as a resilience path
   */
  private async retrieveLexicalMatches(
    query: string,
    maxResults: number
  ): Promise<KnowledgeDocument[]> {
    try {
      const fallbackTerms = this.extractFallbackTerms(query);

      if (fallbackTerms.length === 0) {
        logger.warn('Fallback text search skipped - no usable search terms', { query });
        return [];
      }

      const { data: chunkMatches, error: chunkError } = await supabase
        .from('chunks')
        .select('document_id, content')
        .or(fallbackTerms.map((term) => `content.ilike.%${term}%`).join(','))
        .limit(Math.max(maxResults * 10, maxResults));

      if (chunkError) {
        logger.error('Fallback text search error', { error: chunkError.message });
        return [];
      }

      if (!chunkMatches || chunkMatches.length === 0) {
        logger.info('Fallback text search results', { count: 0, terms: fallbackTerms });
        return [];
      }

      const documentIds = Array.from(
        new Set(chunkMatches.map((chunk) => chunk.document_id).filter(Boolean))
      );

      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('id, title, version, effective_date, status')
        .in('id', documentIds)
        .eq('status', 'active');

      if (documentsError) {
        logger.error('Fallback document metadata error', { error: documentsError.message });
        return [];
      }

      logger.info('Fallback text search results', {
        count: chunkMatches.length,
        terms: fallbackTerms,
      });

      const documentsById = new Map(
        (documentsData || []).map((document) => [document.id, document])
      );

      const documents = chunkMatches
        .map((chunk) => {
          const document = documentsById.get(chunk.document_id);

          if (!document) {
            return null;
          }

          return {
            document_id: chunk.document_id,
            title: document.title,
            version: document.version,
            content: chunk.content,
            effective_date: document.effective_date,
            status: document.status,
            ...annotateLexicalSignals(document.title, chunk.content, fallbackTerms),
          };
        })
        .filter((document): document is KnowledgeDocument => document !== null);

      return documents.slice(0, maxResults);
    } catch (err) {
      logger.error('Fallback text search exception', { error: err });
      return [];
    }
  }

  private extractFallbackTerms(query: string): string[] {
    return extractFallbackSearchTerms(query, this.fallbackStopWords);
  }

  /**
   * Generate answer using LLM with retrieved documents
   */
  private async generateAnswer(
    query: string,
    documents: Array<{ document_id: string; title: string; content: string }>,
    provider: LLMProvider = 'mimo'
  ): Promise<{ answer: string; model: string; latency_ms: number }> {
    if (documents.length === 0) {
      return { answer: 'INSUFFICIENT_EVIDENCE', model: '', latency_ms: 0 };
    }

    // Build context from documents
    const context = documents
      .map((doc, idx) => `[Tài liệu ${idx + 1}: ${doc.title}]\n${doc.content.slice(0, 2000)}`)
      .join('\n\n---\n\n');

    const userPrompt = `Tài liệu tham khảo:\n${context}\n\nCâu hỏi: ${query}\n\nTrả lời:`;

    try {
      const result = await llmChat(
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.3, max_tokens: 1024 },
        provider
      );
      return { answer: result.content, model: result.model, latency_ms: result.latency_ms };
    } catch (err) {
      logger.error('LLM generation error', { error: err, provider });
      throw new Error('Failed to generate answer');
    }
  }

  /**
   * Main query method
   */
  async query(request: KnowledgeAgentRequest): Promise<KnowledgeAgentResponse> {
    const startTime = Date.now();
    const provider: LLMProvider = request.provider || 'mimo';

    try {
      logger.info('Knowledge Agent query started', {
        query: request.query,
        role: request.role,
        episode_id: request.episode_id,
        provider,
      });

      // Step 1: Retrieve relevant documents (vector search with fallback)
      const documents = await this.retrieveDocuments(
        request.query,
        request.max_results || 5
      );

      // Step 2: Check if we have enough evidence
      if (documents.length === 0) {
        return {
          answer: 'Không tìm thấy tài liệu liên quan trong cơ sở tri thức nội bộ. Vui lòng liên hệ quản trị viên hoặc thử câu hỏi khác.',
          citations: [],
          model_version: provider === 'mimo' ? (process.env.MIMO_MODEL_PRIMARY || 'mimo-v2.5-pro') : (process.env.OLLAMA_MODEL || 'qwen2.5:7b'),
          timestamp: new Date().toISOString(),
          status: 'insufficient_evidence',
        };
      }

      // Step 3: Generate answer
      const { answer, model } = await this.generateAnswer(request.query, documents, provider);
      const answerStatus = detectKnowledgeAnswerStatus(answer);

      // Step 4: Check for special responses
      if (answerStatus === 'insufficient_evidence') {
        return {
          answer: 'Tài liệu hiện có không đủ để trả lời câu hỏi này một cách chính xác. Vui lòng cung cấp thêm thông tin hoặc liên hệ chuyên gia.',
          citations: documents.map((doc) => ({
            document_id: doc.document_id,
            document_title: doc.title,
            version: doc.version,
            effective_date: doc.effective_date,
            excerpt: doc.content.slice(0, 200) + '...',
            status: doc.status as 'active' | 'superseded' | 'retired',
          })),
          model_version: model || provider,
          timestamp: new Date().toISOString(),
          status: 'insufficient_evidence',
        };
      }

      if (answerStatus === 'out_of_scope') {
        return {
          answer: 'Câu hỏi này nằm ngoài phạm vi hỗ trợ của hệ thống (viêm phổi Nhi khoa). Vui lòng đặt câu hỏi liên quan đến chuyên môn được hỗ trợ.',
          citations: [],
          model_version: model || provider,
          timestamp: new Date().toISOString(),
          status: 'out_of_scope',
        };
      }

      // Step 5: Build citations
      const citations: Citation[] = documents.map((doc) => ({
        document_id: doc.document_id,
        document_title: doc.title,
        version: doc.version,
        effective_date: doc.effective_date,
        excerpt: doc.content.slice(0, 300) + '...',
        status: doc.status as 'active' | 'superseded' | 'retired',
      }));

      const duration = Date.now() - startTime;
      logger.info('Knowledge Agent query completed', {
        duration: `${duration}ms`,
        citationCount: citations.length,
        status: 'success',
        provider,
        model,
      });

      return {
        answer,
        citations,
        model_version: model,
        timestamp: new Date().toISOString(),
        status: 'success',
      };
    } catch (err) {
      logger.error('Knowledge Agent query failed', { error: err });
      throw err;
    }
  }
}

// Singleton instance
export const knowledgeAgent = new KnowledgeAgent();
