// DON'T import ollamaClient at top-level - lazy import when needed
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';
import type { Citation, Detection, DetectionPayload } from '../types/api.js';

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
  private async retrieveGuidelines(findings: string[]): Promise<Array<{
    document_id: string;
    title: string;
    version: string;
    content: string;
    effective_date: string;
    status: string;
  }>> {
    try {
      // Search for guidelines related to detected findings
      const searchTerms = findings.join(' OR ');

      const { data, error } = await supabase
        .from('documents')
        .select('document_id, title, version, content, effective_date, status')
        .eq('status', 'active')
        .or(`title.ilike.%viêm phổi%,title.ilike.%pneumonia%,content.ilike.%${searchTerms}%`)
        .limit(3);

      if (error) {
        logger.error('Guideline retrieval error', { error: error.message });
        return [];
      }

      return data || [];
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
    guidelines: Array<{ title: string; content: string }>
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
      ? guidelines.map((g, idx) => `[Tài liệu ${idx + 1}: ${g.title}]\n${g.content.slice(0, 1000)}`).join('\n\n---\n\n')
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
        document_title: doc.title,
        version: doc.version,
        effective_date: doc.effective_date,
        excerpt: doc.content.slice(0, 300) + '...',
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
