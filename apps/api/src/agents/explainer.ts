// DON'T import ollamaClient at top-level - lazy import when needed
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';
import type { Citation, Detection, DetectionPayload } from '../types/api.js';

interface GuidelineMatch {
  document_id: string;
  title: string;
  version: string;
  content: string;
  effective_date: string;
  status: string;
  source?: string;
  similarity: number;
}

interface VectorSearchMatch {
  document_id: string;
  content: string;
  similarity: number;
  document_title: string;
  document_version: string;
  effective_date: string;
}

interface ExplainerAgentRequest {
  episode_id: string;
  detection: DetectionPayload;
  clinical_data?: Record<string, any>;
}

interface ExplainerAgentResponse {
  explanation: string;
  citations: Citation[];
  evidence_payload: {
    findings: string[];
    confidence: number;
    warnings?: string[];
  };
  model_version: string;
  timestamp: string;
}

/**
 * Explainer Agent - Generate clinical explanation from detection results
 * Latency target: < 5s
 */
export class ExplainerAgent {
  private readonly systemPrompt = `Bạn là bác sĩ chuyên khoa Nhi - Hô hấp, chuyên về viêm phổi trẻ em.
Nhiệm vụ: Giải thích kết quả phát hiện từ mô hình AI phân tích X-quang ngực cho bác sĩ lâm sàng.

QUY TẮC BẮT BUỘC:
1. CHỈ giải thích những gì mô hình đã phát hiện - KHÔNG tự thêm chẩn đoán mới
2. KHÔNG đưa ra khuyến nghị điều trị cụ thể (kê đơn, y lệnh)
3. Giải thích bằng thuật ngữ y khoa chuyên nghiệp
4. Nêu rõ độ tin cậy (confidence score) của từng phát hiện
5. Cảnh báo nếu có dấu hiệu cần xem xét thêm
6. Trích dẫn guideline/tài liệu tham khảo nếu có

ĐỊNH DẠNG ĐẦU RA — BẮT BUỘC:
- TUYỆT ĐỐI KHÔNG dùng emoji hoặc Unicode pictogram (không dùng biểu tượng, ký tự trang trí, chữ số khoanh tròn...).
- TUYỆT ĐỐI KHÔNG bỏ dấu tiếng Việt. "không" phải viết "không", KHÔNG ĐƯỢC viết "khong". "được" phải viết "được", KHÔNG ĐƯỢC viết "duoc". Mọi từ đều phải có đầy đủ dấu thanh và dấu mũ.
- Giữ nguyên tiếng Việt có dấu đầy đủ trong toàn bộ phản hồi.
- Chỉ văn bản thuần túy, số La-Mã, dấu chấm hay gạch.

Định dạng trả lời:
1. Tóm tắt phát hiện chính
2. Giải thích chi tiết từng finding
3. Đánh giá tổng thể
4. Lưu ý cần xem xét thêm (nếu có)
5. Trích dẫn: [Tài liệu X]`;

  /**
   * Parse detection results into structured findings
   */
  private parseDetections(detection: DetectionPayload): {
    findings: string[];
    confidence: number;
    warnings: string[];
  } {
    const findings: string[] = [];
    const warnings: string[] = [];
    let totalConfidence = 0;

    for (const det of detection.detections) {
      findings.push(`${det.label} (độ tin cậy: ${(det.score * 100).toFixed(1)}%)`);
      totalConfidence += det.score;

      // Warning for low confidence
      if (det.score < 0.7) {
        warnings.push(`${det.label} có độ tin cậy thấp (${(det.score * 100).toFixed(1)}%) - cần xác nhận lại`);
      }
    }

    const avgConfidence = detection.detections.length > 0
      ? totalConfidence / detection.detections.length
      : 0;

    // Warning for no detections
    if (detection.detections.length === 0) {
      warnings.push('Không phát hiện bất thường rõ ràng - cần đánh giá lâm sàng tổng hợp');
    }

    return {
      findings,
      confidence: avgConfidence,
      warnings,
    };
  }

  /**
   * Retrieve relevant clinical guidelines
   */
  private extractFindingKeywords(findings: string[]): string[] {
    const uniqueKeywords = new Set<string>();

    findings.forEach((finding) => {
      finding
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
        .forEach((token) => uniqueKeywords.add(token));
    });

    return Array.from(uniqueKeywords);
  }

  private async retrieveVectorGuidelines(query: string, maxResults: number): Promise<GuidelineMatch[]> {
    try {
      const { embeddingClient } = await import('../lib/embedding/client.js');
      const { embedding } = await embeddingClient.generateEmbedding(query);

      const { data, error } = await supabase.rpc('match_document_chunks', {
        query_embedding: embedding,
        match_threshold: 0.4,
        match_count: Math.max(maxResults * 4, maxResults),
      });

      if (error || !data) {
        logger.warn('Explainer vector retrieval failed', { error: error?.message, query });
        return [];
      }

      const matches = (data as VectorSearchMatch[])
        .filter((match) => Boolean(match.document_id));

      if (matches.length === 0) {
        return [];
      }

      const documentIds = Array.from(new Set(matches.map((match) => match.document_id)));
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('id, title, version, effective_date, status, source')
        .in('id', documentIds)
        .eq('status', 'active');

      if (documentsError) {
        logger.warn('Explainer vector metadata fetch failed', { error: documentsError.message });
      }

      const documentsById = new Map((documentsData || []).map((document) => [document.id, document]));
      const bestByDocument = new Map<string, GuidelineMatch>();

      matches.forEach((match) => {
        const document = documentsById.get(match.document_id);
        const candidate: GuidelineMatch = {
          document_id: match.document_id,
          title: document?.title || match.document_title || 'Tài liệu tham khảo',
          version: document?.version || match.document_version || 'v1.0',
          content: match.content || '',
          effective_date: document?.effective_date || match.effective_date || new Date().toISOString().slice(0, 10),
          status: document?.status || 'active',
          source: document?.source,
          similarity: match.similarity,
        };

        const existing = bestByDocument.get(candidate.document_id);
        if (!existing || candidate.similarity > existing.similarity) {
          bestByDocument.set(candidate.document_id, candidate);
        }
      });

      return Array.from(bestByDocument.values())
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, maxResults);
    } catch (err) {
      logger.error('Explainer vector retrieval exception', { error: err, query });
      return [];
    }
  }

  private async retrieveLexicalGuidelines(keywords: string[], maxResults: number): Promise<GuidelineMatch[]> {
    try {
      if (keywords.length === 0) {
        return [];
      }

      const { data: chunkMatches, error: chunkError } = await supabase
        .from('chunks')
        .select('document_id, content')
        .or(keywords.map((term) => `content.ilike.%${term}%`).join(','))
        .limit(Math.max(maxResults * 8, maxResults));

      if (chunkError || !chunkMatches?.length) {
        logger.warn('Explainer lexical retrieval failed', { error: chunkError?.message, keywords });
        return [];
      }

      const documentIds = Array.from(new Set(chunkMatches.map((chunk) => chunk.document_id).filter(Boolean)));
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('id, title, version, effective_date, status, source')
        .in('id', documentIds)
        .eq('status', 'active');

      if (documentsError) {
        logger.warn('Explainer lexical metadata fetch failed', { error: documentsError.message });
        return [];
      }

      const documentsById = new Map((documentsData || []).map((document) => [document.id, document]));
      const ranked = chunkMatches
        .map((chunk) => {
          const document = documentsById.get(chunk.document_id);
          if (!document) {
            return null;
          }

          const haystack = `${document.title ?? ''}\n${chunk.content ?? ''}`.toLowerCase();
          const score = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 1 : 0), 0);

          return {
            document_id: chunk.document_id,
            title: document.title || 'Tài liệu tham khảo',
            version: document.version || 'v1.0',
            content: chunk.content || '',
            effective_date: document.effective_date || new Date().toISOString().slice(0, 10),
            status: document.status || 'active',
            source: document.source,
            similarity: score / keywords.length,
          } satisfies GuidelineMatch;
        })
        .filter((match): match is GuidelineMatch => match !== null)
        .sort((left, right) => right.similarity - left.similarity);

      const bestByDocument = new Map<string, GuidelineMatch>();
      ranked.forEach((match) => {
        if (!bestByDocument.has(match.document_id)) {
          bestByDocument.set(match.document_id, match);
        }
      });

      return Array.from(bestByDocument.values()).slice(0, maxResults);
    } catch (err) {
      logger.error('Explainer lexical retrieval exception', { error: err, keywords });
      return [];
    }
  }

  private async retrieveGuidelines(findings: string[]): Promise<Array<{
    document_id: string;
    title: string;
    version: string;
    content: string;
    effective_date: string;
    status: string;
    source?: string;
    similarity: number;
  }>> {
    try {
      const keywords = this.extractFindingKeywords(findings);
      const vectorMatches = await this.retrieveVectorGuidelines(findings.join(' '), 3);

      if (vectorMatches.length > 0) {
        return vectorMatches;
      }

      return this.retrieveLexicalGuidelines(keywords, 3);
    } catch (err) {
      logger.error('Guideline retrieval exception', { error: err });
      return [];
    }
  }

  /**
   * Generate explanation using LLM
   */
  private async generateExplanation(
    detection: DetectionPayload,
    clinicalData: Record<string, any> | undefined,
    guidelines: Array<{ title: string; content: string; effective_date?: string; similarity?: number; source?: string }>
  ): Promise<string> {
    // Build detection summary
    const detectionSummary = detection.detections
      .map((d, idx) => `${idx + 1}. ${d.label} - Vị trí: [${d.bbox.join(', ')}] - Độ tin cậy: ${(d.score * 100).toFixed(1)}%`)
      .join('\n');

    // Build clinical context
    const clinicalContext = clinicalData
      ? `Dữ liệu lâm sàng:\n${JSON.stringify(clinicalData, null, 2)}`
      : 'Không có dữ liệu lâm sàng bổ sung.';

    // Build guideline context
    const guidelineContext = guidelines.length > 0
      ? guidelines.map((g, idx) => `[Tài liệu ${idx + 1}: ${g.title}] (${g.source || 'reference'} · ${(g.similarity ?? 0) * 100}%)\n${g.content.slice(0, 1000)}`).join('\n\n---\n\n')
      : 'Không có guideline tham khảo.';

    const userPrompt = `Kết quả phát hiện từ mô hình AI:
${detectionSummary}

${clinicalContext}

Tài liệu tham khảo:
${guidelineContext}

Hãy giải thích kết quả này cho bác sĩ lâm sàng:`;

    try {
      // Lazy import ollamaClient
      const { ollamaClient } = await import('../lib/ollama/client.js');

      const explanation = await ollamaClient.generateWithTemplate(
        this.systemPrompt,
        userPrompt,
        {
          temperature: 0.5, // Moderate temperature for clinical explanation
          num_predict: 1536,
        }
      );

      return explanation.trim();
    } catch (err) {
      logger.error('Explanation generation error', { error: err });
      throw new Error('Failed to generate explanation');
    }
  }

  /**
   * Main explain method
   */
  async explain(request: ExplainerAgentRequest): Promise<ExplainerAgentResponse> {
    const startTime = Date.now();

    try {
      logger.info('Explainer Agent started', {
        episode_id: request.episode_id,
        detectionCount: request.detection.detections.length,
      });

      // Step 1: Parse detections
      const evidencePayload = this.parseDetections(request.detection);

      // Step 2: Retrieve relevant guidelines
      const guidelines = await this.retrieveGuidelines(evidencePayload.findings);

      // Step 3: Generate explanation
      const explanation = await this.generateExplanation(
        request.detection,
        request.clinical_data,
        guidelines
      );

      // Step 4: Build citations
      const citations: Citation[] = guidelines.map((doc) => ({
        document_id: doc.document_id,
        document_title: doc.title ?? 'Tài liệu tham khảo',
        version: doc.version ?? 'v1.0',
        effective_date: doc.effective_date ?? new Date().toISOString().slice(0, 10),
        excerpt: `${(doc.content ?? '').slice(0, 300)}...`,
        source: doc.source,
        similarity: doc.similarity,
        status: doc.status as 'active' | 'superseded' | 'retired',
      }));

      const duration = Date.now() - startTime;
      logger.info('Explainer Agent completed', {
        duration: `${duration}ms`,
        findingsCount: evidencePayload.findings.length,
        citationCount: citations.length,
      });

      return {
        explanation,
        citations,
        evidence_payload: evidencePayload,
        model_version: request.detection.model_version || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('Explainer Agent failed', { error: err });
      throw err;
    }
  }
}

// Singleton instance
export const explainerAgent = new ExplainerAgent();
