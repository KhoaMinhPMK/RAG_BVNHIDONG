import { supabase } from '../lib/supabase/client.js';
// DON'T import ollamaClient at top-level - lazy import when needed
// Lazy import embeddingClient when needed
import { logger } from '../lib/utils/logger.js';
import type { Citation } from '../types/api.js';

interface KnowledgeAgentRequest {
  query: string;
  role: string;
  episode_id?: string;
  max_results?: number;
}

interface KnowledgeAgentResponse {
  answer: string;
  citations: Citation[];
  model_version: string;
  timestamp: string;
  uncertainty?: number;
  status: 'success' | 'insufficient_evidence' | 'out_of_scope';
}

/**
 * Knowledge Agent - RAG retrieval for guideline/SOP queries
 * Latency target: < 3s
 */
export class KnowledgeAgent {
  private readonly systemPrompt = `Bạn là trợ lý y tế chuyên về viêm phổi Nhi khoa.
Nhiệm vụ: Trả lời câu hỏi dựa HOÀN TOÀN trên tài liệu được cung cấp.

QUY TẮC BẮT BUỘC:
1. CHỈ trả lời dựa trên tài liệu được cung cấp
2. KHÔNG tự suy diễn hoặc thêm thông tin ngoài tài liệu
3. Nếu không đủ bằng chứng → trả lời "INSUFFICIENT_EVIDENCE"
4. Nếu câu hỏi ngoài phạm vi y tế Nhi khoa → trả lời "OUT_OF_SCOPE"
5. Trích dẫn rõ nguồn bằng cách ghi [Tài liệu X]
6. Trả lời ngắn gọn, rõ ràng, chuyên nghiệp

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
  ): Promise<Array<{ document_id: string; title: string; version: string; content: string; effective_date: string; status: string }>> {
    try {
      // Try vector similarity search first
      const queryEmbedding = await this.generateQueryEmbedding(query);

      const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: maxResults,
      });

      if (error) {
        logger.warn('Vector search failed, falling back to text search', {
          error: error.message,
        });
        return this.fallbackTextSearch(query, maxResults);
      }

      // Convert chunk results to document format
      if (data && data.length > 0) {
        logger.info('Vector search results', { count: data.length, query });
        return data.map((chunk: any) => ({
          document_id: chunk.document_id,
          title: chunk.document_title || 'Unknown',
          version: chunk.document_version || 'v1.0',
          content: chunk.content,
          effective_date: chunk.effective_date || '',
          status: 'active',
        }));
      }

      logger.warn('No vector search results, falling back to text search');
      return this.fallbackTextSearch(query, maxResults);
    } catch (err) {
      logger.error('Document retrieval exception', { error: err });
      // Fallback to text search on any error
      return this.fallbackTextSearch(query, maxResults);
    }
  }

  /**
   * Fallback: Simple text search when vector search is unavailable
   */
  private async fallbackTextSearch(
    query: string,
    maxResults: number
  ): Promise<Array<{ document_id: string; title: string; version: string; content: string; effective_date: string; status: string }>> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('id, title, version, effective_date')
        .eq('document_type', 'active' as any)
        .textSearch('title', query, { type: 'websearch', config: 'english' })
        .limit(maxResults);

      if (error) {
        logger.error('Fallback text search error', { error: error.message });
        return [];
      }

      logger.info('Fallback text search results', { count: data?.length || 0 });

      // Fetch full content for each document
      const documents = await Promise.all(
        (data || []).map(async (doc: any) => {
          const { data: chunks, error: chunksError } = await supabase
            .from('document_chunks')
            .select('content')
            .eq('document_id', doc.id)
            .order('chunk_index', { ascending: true })
            .limit(5);

          if (chunksError || !chunks || chunks.length === 0) {
            return null;
          }

          const fullContent = chunks.map(c => c.content).join('\n\n');

          return {
            document_id: doc.id,
            title: doc.title,
            version: doc.version,
            content: fullContent,
            effective_date: doc.effective_date,
            status: 'active',
          };
        })
      );

      return documents.filter((d): d is NonNullable<typeof d> => d !== null);
    } catch (err) {
      logger.error('Fallback text search exception', { error: err });
      return [];
    }
  }

  /**
   * Generate answer using LLM with retrieved documents
   */
  private async generateAnswer(
    query: string,
    documents: Array<{ document_id: string; title: string; content: string }>
  ): Promise<string> {
    if (documents.length === 0) {
      return 'INSUFFICIENT_EVIDENCE';
    }

    // Build context from documents
    const context = documents
      .map((doc, idx) => `[Tài liệu ${idx + 1}: ${doc.title}]\n${doc.content.slice(0, 2000)}`)
      .join('\n\n---\n\n');

    const userPrompt = `Tài liệu tham khảo:
${context}

Câu hỏi: ${query}

Trả lời:`;

    try {
      // Lazy import ollamaClient
      const { ollamaClient } = await import('../lib/ollama/client.js');

      const answer = await ollamaClient.generateWithTemplate(
        this.systemPrompt,
        userPrompt,
        {
          temperature: 0.3, // Low temperature for factual answers
          num_predict: 1024,
        }
      );

      return answer.trim();
    } catch (err) {
      logger.error('LLM generation error', { error: err });
      throw new Error('Failed to generate answer');
    }
  }

  /**
   * Main query method
   */
  async query(request: KnowledgeAgentRequest): Promise<KnowledgeAgentResponse> {
    const startTime = Date.now();

    try {
      logger.info('Knowledge Agent query started', {
        query: request.query,
        role: request.role,
        episode_id: request.episode_id,
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
          model_version: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          timestamp: new Date().toISOString(),
          status: 'insufficient_evidence',
        };
      }

      // Step 3: Generate answer
      const answer = await this.generateAnswer(request.query, documents);

      // Step 4: Check for special responses
      if (answer === 'INSUFFICIENT_EVIDENCE') {
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
          model_version: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          timestamp: new Date().toISOString(),
          status: 'insufficient_evidence',
        };
      }

      if (answer === 'OUT_OF_SCOPE') {
        return {
          answer: 'Câu hỏi này nằm ngoài phạm vi hỗ trợ của hệ thống (viêm phổi Nhi khoa). Vui lòng đặt câu hỏi liên quan đến chuyên môn được hỗ trợ.',
          citations: [],
          model_version: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
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
      });

      return {
        answer,
        citations,
        model_version: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
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
