// DON'T import ollamaClient at top-level - lazy import when needed
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';
import type { Citation, DetectionPayload, DraftField, DraftReportResponse } from '../types/api.js';

interface ReporterAgentRequest {
  episode_id: string;
  template_id: string;
  detection: DetectionPayload;
  clinical_data?: Record<string, any>;
}

interface GuidelineSnippet {
  document_id?: string;
  title: string;
  version?: string;
  content: string;
  effective_date?: string;
}

/**
 * Reporter Agent - Generate draft report from template
 * Latency target: < 8s
 */
export class ReporterAgent {
  private readonly systemPrompt = `Bạn là bác sĩ chuyên khoa Nhi - Hô hấp, chuyên viết báo cáo X-quang ngực.
Nhiệm vụ: Điền thông tin vào mẫu báo cáo dựa trên kết quả phát hiện và dữ liệu lâm sàng.

QUY TẮC BẮT BUỘC:
1. CHỈ điền thông tin dựa trên dữ liệu được cung cấp
2. KHÔNG tự thêm chẩn đoán hoặc khuyến nghị điều trị
3. Sử dụng thuật ngữ y khoa chuẩn
4. Nếu thiếu thông tin → để trống hoặc ghi "Cần bổ sung"
5. Đánh dấu rõ phần nào do AI sinh, phần nào cần bác sĩ xác nhận
6. Trích dẫn nguồn tài liệu tham khảo
7. TUYỆT ĐỐI KHÔNG dùng emoji hoặc Unicode pictogram trong bất kỳ trường nào.
8. TUYỆT ĐỐI KHÔNG bỏ dấu tiếng Việt. "không" phải viết "không", KHÔNG ĐƯỢC viết "khong". Mọi từ đều phải có đầy đủ dấu thanh và dấu mũ.

Định dạng: JSON với các trường theo template`;

  /** Built-in fallback template used when DB has no matching record */
  private readonly fallbackTemplate = {
    template_id: 'default',
    name: 'Báo cáo phân tích X-quang ngực nhi',
    schema: {
      fields: [
        { field_id: 'chief_complaint',     label: 'Lý do nhập viện',       type: 'text',     required: true  },
        { field_id: 'vitals_summary',      label: 'Tóm tắt sinh hiệu',     type: 'text',     required: true  },
        { field_id: 'lab_summary',         label: 'Tóm tắt xét nghiệm',    type: 'text',     required: true  },
        { field_id: 'xray_findings',       label: 'Kết quả X-quang (AI)',   type: 'text',     required: false },
        { field_id: 'clinical_assessment', label: 'Đánh giá lâm sàng',     type: 'textarea', required: true  },
        { field_id: 'differential_dx',    label: 'Chẩn đoán vi phân',      type: 'textarea', required: true  },
        { field_id: 'recommendations',    label: 'Đề xuất xử lý',          type: 'textarea', required: true  },
        { field_id: 'physician_note',     label: 'Ghi chú bác sĩ',         type: 'textarea', required: false },
      ],
    },
  };

  /**
   * Get report template from database, fall back to built-in default if not found
   */
  private async getTemplate(templateId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('report_templates')
        .select('*')
        .eq('template_id', templateId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        logger.warn('Template not found in DB, using built-in fallback', { templateId });
        return this.fallbackTemplate;
      }

      return data;
    } catch (err) {
      logger.warn('Template retrieval failed, using built-in fallback', { templateId });
      return this.fallbackTemplate;
    }
  }

  /**
   * Generate draft report using LLM
   */
  private async generateDraft(
    template: any,
    detection: DetectionPayload,
    clinicalData: Record<string, any> | undefined,
    guidelines: GuidelineSnippet[]
  ): Promise<{ fields: DraftField[]; citations: Citation[] }> {
    // Build detection summary
    const detectionSummary = detection.detections
      .map((d) => `- ${d.label} (độ tin cậy: ${(d.score * 100).toFixed(1)}%)`)
      .join('\n');

    // Build clinical context
    const clinicalContext = clinicalData
      ? JSON.stringify(clinicalData, null, 2)
      : 'Không có dữ liệu lâm sàng';

    // Build template fields
    const templateFields = template.schema.fields
      .map((f: any) => `- ${f.field_id}: ${f.label} (${f.type}, ${f.required ? 'bắt buộc' : 'tùy chọn'})`)
      .join('\n');

    const userPrompt = `Mẫu báo cáo: ${template.name}
Các trường cần điền:
${templateFields}

Kết quả phát hiện:
${detectionSummary}

Dữ liệu lâm sàng:
${clinicalContext}

Hãy điền thông tin vào các trường báo cáo. Trả lời theo định dạng JSON:
{
  "field_id": "nội dung điền vào",
  ...
}`;

    try {
      // Lazy import ollamaClient
      const { ollamaClient } = await import('../lib/ollama/client.js');

      const response = await ollamaClient.generateWithTemplate(
        this.systemPrompt,
        userPrompt,
        {
          temperature: 0.4,
          num_predict: 2048,
        }
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse JSON from LLM response');
      }

      const fieldValues = JSON.parse(jsonMatch[0]);

      // Build draft fields
      const fields: DraftField[] = template.schema.fields.map((f: any) => ({
        field_id: f.field_id,
        label: f.label,
        value: fieldValues[f.field_id] != null ? String(fieldValues[f.field_id]) : '',
        source: 'ai' as const,
        provenance: guidelines.map((g) => ({
          document_id: g.document_id || '',
          document_title: g.title,
          version: g.version || '1.0',
          effective_date: g.effective_date || new Date().toISOString(),
          excerpt: g.content.slice(0, 200) + '...',
        })),
        status: fieldValues[f.field_id] ? 'valid' : 'needs_review' as const,
      }));

      const citations: Citation[] = guidelines.map((g) => ({
        document_id: g.document_id || '',
        document_title: g.title,
        version: g.version || '1.0',
        effective_date: g.effective_date || new Date().toISOString(),
        excerpt: g.content.slice(0, 300) + '...',
      }));

      return { fields, citations };
    } catch (err) {
      logger.error('Draft generation error', { error: err });
      throw new Error('Failed to generate draft report');
    }
  }

  /**
   * Main draft method
   */
  async draft(request: ReporterAgentRequest): Promise<DraftReportResponse> {
    const startTime = Date.now();

    try {
      logger.info('Reporter Agent started', {
        episode_id: request.episode_id,
        template_id: request.template_id,
      });

      // Step 1: Get template
      const template = await this.getTemplate(request.template_id);

      // Step 2: Retrieve guidelines (reuse from explainer logic)
      const { data: guidelines } = await supabase
        .from('documents')
        .select('document_id, title, version, content, effective_date')
        .eq('status', 'active')
        .limit(3);

      // Step 3: Generate draft
      const { fields, citations } = await this.generateDraft(
        template,
        request.detection,
        request.clinical_data,
        guidelines || []
      );

      // Step 4: Save draft to database
      // Use NULL for template_id when using the built-in fallback (non-UUID value)
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(request.template_id);
      const draftId = crypto.randomUUID();
      const { error: insertError } = await supabase
        .from('draft_reports')
        .insert({
          draft_id: draftId,
          episode_id: request.episode_id,
          template_id: isUUID ? request.template_id : null,
          fields: fields,
          status: 'draft',
          model_version: request.detection.model_version || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        logger.error('Draft save error', { error: insertError.message });
      }

      const duration = Date.now() - startTime;
      logger.info('Reporter Agent completed', {
        duration: `${duration}ms`,
        draft_id: draftId,
        fieldCount: fields.length,
      });

      return {
        draft_id: draftId,
        template_id: request.template_id,
        episode_id: request.episode_id,
        fields,
        status: 'draft',
        model_version: request.detection.model_version || process.env.OLLAMA_MODEL || 'qwen2.5:7b',
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      logger.error('Reporter Agent failed', { error: err });
      throw err;
    }
  }
}

// Singleton instance
export const reporterAgent = new ReporterAgent();
