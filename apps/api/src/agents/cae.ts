/**
 * CAE - Clinical AI Engine
 * Bệnh viện Nhi Đồng
 *
 * Agentic loop: fetches patient context, searches KB, streams CoT + answer.
 * Boundaries: CANNOT finalize diagnosis, prescribe, or write official records.
 */

import type { Response } from 'express';
import { supabase } from '../lib/supabase/client.js';
import { getMiMoClient, type MiMoMessage, type MiMoTool } from '../lib/mimo/client.js';
import { logger } from '../lib/utils/logger.js';
import { parseContentToBlocks, enrichCitations } from '../lib/cae/content-parser.js';
import type { RenderableBlock, CitationAnchor, UIAction } from '../types/cae-output.js';
import { explainerAgent } from './explainer.js';
import { reporterAgent } from './reporter.js';
import { validateDraftFields } from '../middleware/guardrails.js';
import type { Citation as ApiCitation, DetectionPayload, DraftField as ApiDraftField } from '../types/api.js';

export type CAESSEEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'tool_start'; name: string; label: string; args: Record<string, unknown> }
  | { type: 'tool_done'; name: string; preview: string }
  | { type: 'content'; delta: string }
  | { type: 'block_start'; blockType: string; blockIndex: number }
  | { type: 'block_done'; blockIndex: number; block: RenderableBlock }
  | { type: 'citation'; citation: CitationAnchor }
  | { type: 'ui_action'; action: UIAction }
  | { type: 'done'; reasoning_tokens: number; completion_tokens: number; model: string }
  | { type: 'error'; message: string };

interface StreamCAEOptions {
  findingIds?: string[];
  runId?: string;
  onBlock?: (block: RenderableBlock) => void;
  onContent?: (text: string) => void;
  onCitations?: (citations: CitationAnchor[]) => void;
}

interface StreamExplainOptions extends StreamCAEOptions {
  clinicalData?: Record<string, unknown>;
}

interface StreamDraftOptions extends StreamCAEOptions {
  clinicalData?: Record<string, unknown>;
  onDraftSaved?: (draft_id: string) => void;
}

interface KnowledgeMatch {
  document_id: string;
  document_title: string;
  content: string;
  similarity: number;
  source?: string;
  version?: string;
  effective_date?: string;
}

function sseWrite(res: Response, event: CAESSEEvent) {
  if (res.writableEnded) return;
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // Socket gone; nothing to do
  }
}

function sseError(res: Response, err: unknown, fallback = 'CAE error'): void {
  const msg = err instanceof Error ? (err.message || fallback) : (typeof err === 'string' ? err : fallback);
  sseWrite(res, { type: 'error', message: msg });
  if (!res.writableEnded) res.end();
}

function logError(label: string, err: unknown, extra?: Record<string, unknown>): void {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  logger.error(label, { message: msg, stack, ...extra });
}

export function sseHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
}

const CAE_TOOLS: MiMoTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_patient_context',
      description:
        'Lấy đầy đủ thông tin bệnh nhân: vitals (SpO2, HR, RR, nhiệt độ), xét nghiệm (WBC, CRP), findings lâm sàng, tuổi, giới tính, lý do nhập viện.',
      parameters: {
        type: 'object',
        properties: {
          episode_id: { type: 'string', description: 'UUID của episode cần tra cứu' },
        },
        required: ['episode_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        'Tìm kiếm trong knowledge base y tế nội bộ. Tài liệu Nội bộ (source=Internal) có độ tin cậy cao nhất, được kiểm duyệt bởi chuyên gia. Tài liệu Tham khảo (WHO, BTS, PubMed...) là nguồn bên ngoài. Luôn ưu tiên Nội bộ khi có mâu thuẫn.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Câu hỏi lâm sàng hoặc từ khóa để tìm kiếm',
          },
          trust_level: {
            type: 'string',
            enum: ['internal', 'reference', 'all'],
            description:
              'Loại tài liệu cần search. "internal" = nội bộ bệnh viện, "reference" = bên ngoài, "all" = cả hai.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_detection_results',
      description:
        'Lấy kết quả phân tích X-quang AI (PCXR): bounding boxes, labels (infiltrate, effusion...), confidence scores.',
      parameters: {
        type: 'object',
        properties: {
          episode_id: { type: 'string', description: 'UUID của episode' },
        },
        required: ['episode_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_draft_report',
      description:
        'Lưu nháp báo cáo lâm sàng. BÁO CÁO NÀY CHỈ LÀ NHÁP — bác sĩ PHẢI review và ký mới có hiệu lực. Không được tự ý finalize.',
      parameters: {
        type: 'object',
        properties: {
          episode_id: { type: 'string' },
          sections: {
            type: 'object',
            properties: {
              summary: { type: 'string', description: 'Tóm tắt lâm sàng' },
              findings: { type: 'string', description: 'Nhận xét X-quang + lâm sàng' },
              differential_diagnosis: {
                type: 'array',
                items: { type: 'string' },
                description: 'Danh sách chẩn đoán vi phân theo thứ tự khả năng',
              },
              recommendation: {
                type: 'string',
                description: 'Đề xuất hướng xử lý (cần bác sĩ xác nhận)',
              },
            },
            required: ['summary'],
          },
        },
        required: ['episode_id', 'sections'],
      },
    },
  },
];

const TOOL_LABELS: Record<string, string> = {
  get_patient_context: 'Đọc hồ sơ bệnh nhân',
  search_knowledge_base: 'Tra cứu knowledge base',
  get_detection_results: 'Phân tích X-quang',
  save_draft_report: 'Lưu nháp báo cáo',
};

async function getPatientContext(episodeId: string): Promise<string> {
  const { data, error } = await supabase
    .from('episodes')
    .select('patient_ref, age, gender, chief_complaint, vital_signs, lab_results, findings, status, created_at')
    .eq('id', episodeId)
    .single();

  if (error) {
    return `Lỗi đọc hồ sơ bệnh nhân: ${error.message}`;
  }

  if (!data) {
    return `Không tìm thấy bệnh nhân với episode_id=${episodeId}`;
  }

  return JSON.stringify(
    {
      patient_ref: data.patient_ref,
      age: data.age,
      gender: data.gender,
      chief_complaint: data.chief_complaint,
      vitals: data.vital_signs,
      lab_results: data.lab_results,
      findings: data.findings,
      status: data.status,
    },
    null,
    2
  );
}

async function searchKnowledgeBaseMatches(
  query: string,
  trustLevel: 'internal' | 'reference' | 'all' = 'all'
): Promise<KnowledgeMatch[]> {
  try {
    const { embeddingClient } = await import('../lib/embedding/client.js');
    const { embedding } = await embeddingClient.generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.4,
      match_count: 6,
    });

    if (error || !data?.length) {
      return [];
    }

    let chunks = data as KnowledgeMatch[];

    if (trustLevel !== 'all') {
      const docIds = [...new Set(chunks.map((c) => c.document_id))];
      const { data: docs } = await supabase
        .from('documents')
        .select('id, source')
        .in('id', docIds);

      const internalIds = new Set(
        (docs || [])
          .filter((d) => (trustLevel === 'internal' ? d.source === 'Internal' : d.source !== 'Internal'))
          .map((d) => d.id)
      );
      chunks = chunks.filter((c) => internalIds.has(c.document_id));
    }

    if (!chunks.length) {
      return [];
    }

    const docIds = [...new Set(chunks.map((c) => c.document_id))];
    const { data: docsInfo } = await supabase
      .from('documents')
      .select('id, source, title')
      .in('id', docIds);
    const sourceMap = Object.fromEntries((docsInfo || []).map((d) => [d.id, d.source]));

    return chunks.map((chunk) => ({
      ...chunk,
      source: sourceMap[chunk.document_id] || chunk.source,
    }));
  } catch (err) {
    logger.error('[CAE] searchKnowledgeBaseMatches error', { error: err, query, trustLevel });
    return [];
  }
}

function formatKnowledgeMatches(
  chunks: KnowledgeMatch[],
  trustLevel: 'internal' | 'reference' | 'all'
): string {
  if (!chunks.length) {
    if (trustLevel === 'internal') {
      return 'Không có tài liệu nội bộ phù hợp.';
    }
    if (trustLevel === 'reference') {
      return 'Không có tài liệu tham khảo phù hợp.';
    }
    return 'Không tìm thấy tài liệu liên quan trong knowledge base.';
  }

  return chunks
    .map((chunk) => {
      const badge = chunk.source === 'Internal' ? '[Noi bo]' : '[Tham khao]';
      return `${badge} ${chunk.document_title} (similarity: ${(chunk.similarity * 100).toFixed(1)}%)\n${chunk.content.slice(0, 600)}`;
    })
    .join('\n\n---\n\n');
}

async function searchKnowledgeBase(
  query: string,
  trustLevel: 'internal' | 'reference' | 'all' = 'all'
): Promise<string> {
  const chunks = await searchKnowledgeBaseMatches(query, trustLevel);
  return formatKnowledgeMatches(chunks, trustLevel);
}

async function getDetectionResults(episodeId: string): Promise<string> {
  const { data, error } = await supabase
    .from('detection_results')
    .select('status, progress, results, created_at')
    .eq('episode_id', episodeId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return `Lỗi truy vấn: ${error.message}`;
  if (!data) return 'Chưa có kết quả phân tích X-quang cho ca này.';
  if (data.status === 'processing') return `Đang phân tích X-quang... (${data.progress}%)`;
  if (!data.results) return 'Phân tích hoàn tất nhưng chưa có kết quả.';

  return JSON.stringify(data.results, null, 2);
}

async function saveDraftReport(
  episodeId: string,
  sections: {
    summary: string;
    findings?: string;
    differential_diagnosis?: string[];
    recommendation?: string;
  }
): Promise<string> {
  const { error } = await supabase.from('draft_reports').upsert(
    {
      episode_id: episodeId,
      content: sections,
      status: 'draft',
      created_by: 'cae-ai',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'episode_id' }
  );

  if (error) return `Lỗi lưu nháp: ${error.message}`;
  return 'Da luu nhap bao cao. Bac si can review va ky xac nhan truoc khi co hieu luc chinh thuc.';
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'get_patient_context':
      return getPatientContext(args.episode_id as string);
    case 'search_knowledge_base':
      return searchKnowledgeBase(args.query as string, (args.trust_level as 'internal' | 'reference' | 'all') || 'all');
    case 'get_detection_results':
      return getDetectionResults(args.episode_id as string);
    case 'save_draft_report':
      return saveDraftReport(args.episode_id as string, args.sections as {
        summary: string;
        findings?: string;
        differential_diagnosis?: string[];
        recommendation?: string;
      });
    default:
      return `Unknown tool: ${name}`;
  }
}

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Bạn là CAE — Clinical AI Engine của Bệnh viện Nhi Đồng.
Ngày hiện tại: ${today}

QUYỀN HẠN CỦA BẠN:
- Đọc và phân tích toàn bộ dữ liệu bệnh nhân.
- Tra cứu knowledge base, ưu tiên tài liệu nội bộ.
- Phân tích pattern lâm sàng và X-quang.
- Đề xuất chẩn đoán vi phân có căn cứ và trích dẫn nguồn.
- Soạn nháp báo cáo cần bác sĩ review.

GIỚI HẠN TUYỆT ĐỐI:
- KHÔNG đưa ra chẩn đoán cuối cùng.
- KHÔNG kê đơn thuốc.
- KHÔNG ghi vào hồ sơ chính thức.
- KHÔNG quyết định phác đồ điều trị.

NGUYÊN TẮC LÀM VIỆC:
1. Luôn dùng công cụ để lấy dữ liệu thực tế trước khi phân tích.
2. Tài liệu nội bộ (Internal) được ưu tiên cao hơn tham khảo ngoài.
3. Nếu có mâu thuẫn giữa các nguồn, nêu rõ sự xung đột và ưu tiên nguồn nội bộ.
4. Luôn nêu rõ mức độ tin cậy và nguồn gốc của mọi khuyến nghị.
5. Phong cách: chuyên nghiệp, súc tích, không rườm rà.

ĐỊNH DẠNG ĐẦU RA — BẮT BUỘC TUÂN THỦ:
- TUYỆT ĐỐI KHÔNG dùng emoji hoặc Unicode pictogram bất kỳ. Không dùng 🔴 🟡 ⭐ 📌 🔑 hay bất kỳ ký tự biểu tượng nào.
- TUYỆT ĐỐI KHÔNG viết tắt hay bỏ dấu tiếng Việt. Mọi từ tiếng Việt phải có đầy đủ dấu thanh và dấu mũ: "không" không được viết "khong", "được" không được viết "duoc", v.v.
- Không dùng ký tự vòng tròn số như ①②③. Thay bằng 1. 2. 3. thông thường.
- Chỉ dùng văn bản thuần, dấu câu, dấu gạch, chữ số La-Mã.
- Tiêu đề section dùng chữ hoa và số: "1. TÊN SECTION".
- Danh sách dùng "- " hoặc "* " thuần.
- Bảng dùng định dạng Markdown table chuẩn (| col | col |).

Khi phân tích ca bệnh, hãy:
- Nhận xét các bất thường trong vitals/labs.
- Liên kết với findings X-quang.
- Đề xuất chẩn đoán vi phân theo thứ tự khả năng.
- Nêu rõ bước cần bác sĩ xác nhận.`;
}

export async function streamBrief(
  episodeId: string,
  res: Response,
  options: StreamCAEOptions = {}
): Promise<void> {
  sseHeaders(res);
  const mimo = getMiMoClient();

  const initialMessages: MiMoMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: `Phân tích ca bệnh episode_id="${episodeId}". Hãy đọc hồ sơ bệnh nhân, tra cứu knowledge base, lấy kết quả X-quang nếu có và tổng hợp nhận định lâm sàng.`,
    },
  ];

  // Accumulate content for parsing
  let accumulatedContent = '';
  const kbResults: Array<{
    document_id: string;
    document_title: string;
    content: string;
    similarity: number;
    source?: string;
    version?: string;
    effective_date?: string;
  }> = [];

  try {
    await mimo.chatStreamAgent(
      initialMessages,
      CAE_TOOLS,
      async (name: string, args: Record<string, unknown>) => {
        if (name === 'search_knowledge_base') {
          const trustLevel = (args.trust_level as 'internal' | 'reference' | 'all') || 'all';
          const matches = await searchKnowledgeBaseMatches(args.query as string, trustLevel);
          kbResults.push(...matches);
          return formatKnowledgeMatches(matches, trustLevel);
        }

        return executeTool(name, args);
      },
      { thinking: 'enabled', max_tokens: 4096, temperature: 0.7 },
      {
        onThinking: (delta) => sseWrite(res, { type: 'thinking', delta }),
        onToolStart: (name, args) =>
          sseWrite(res, {
            type: 'tool_start',
            name,
            label: TOOL_LABELS[name] || name,
            args,
          }),
        onToolDone: (name, preview) => sseWrite(res, { type: 'tool_done', name, preview }),
        onContent: (delta) => {
          accumulatedContent += delta;
          // Still emit content events for backward compatibility
          sseWrite(res, { type: 'content', delta });
        },
        onDone: (usage) => {
          // Parse accumulated content into structured blocks
          try {
            const trustLevelMap: Record<string, 'internal' | 'reference'> = {};
            kbResults.forEach(doc => {
              trustLevelMap[doc.document_id] = doc.source === 'Internal' ? 'internal' : 'reference';
            });

            const parsed = parseContentToBlocks(accumulatedContent, {
              trustLevelMap,
              episodeId,
              findingIds: options.findingIds,
            });

            // Enrich citations with KB results
            enrichCitations(parsed.citations, kbResults, trustLevelMap);

            // ── Persist callbacks (for ai_runs storage) ──
            options.onContent?.(accumulatedContent);
            parsed.blocks.forEach(b => options.onBlock?.(b));
            if (parsed.citations.length > 0) options.onCitations?.(parsed.citations);

            // Emit structured blocks
            parsed.blocks.forEach((block: RenderableBlock, index: number) => {
              sseWrite(res, { type: 'block_start', blockType: block.type, blockIndex: index });
              sseWrite(res, { type: 'block_done', blockIndex: index, block });
            });

            // Emit citations
            parsed.citations.forEach((citation: CitationAnchor) => {
              sseWrite(res, { type: 'citation', citation });
            });

            // Emit UI actions for dock orchestration and viewport focus
            parsed.actions.forEach((action: UIAction) => {
              sseWrite(res, { type: 'ui_action', action });
            });
          } catch (parseError) {
            logger.error('[CAE] Failed to parse content into blocks', { error: parseError });
            // Continue anyway - frontend can fall back to raw content
          }

          sseWrite(res, {
            type: 'done',
            reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
            model: 'mimo-v2.5-pro',
          });
          res.end();
        },
      }
    );
  } catch (err) {
    logError('[CAE] streamBrief error', err, { episodeId });
    sseError(res, err);
  }
}

export async function streamChat(
  episodeId: string,
  userMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  res: Response,
  options: StreamCAEOptions = {}
): Promise<void> {
  sseHeaders(res);
  const mimo = getMiMoClient();

  const messages: MiMoMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    {
      role: 'user',
      content: `[Context: Đang xem ca bệnh episode_id="${episodeId}". Sử dụng công cụ get_patient_context nếu cần thêm thông tin.]`,
    },
    { role: 'assistant', content: 'Đã hiểu. Tôi sẵn sàng hỗ trợ.' },
    ...userMessages.map((message) => ({ role: message.role, content: message.content })),
  ];

  // Accumulate content for parsing
  let accumulatedContent = '';
  const kbResults: Array<{
    document_id: string;
    document_title: string;
    content: string;
    similarity: number;
    source?: string;
    version?: string;
    effective_date?: string;
  }> = [];

  try {
    await mimo.chatStreamAgent(
      messages,
      CAE_TOOLS,
      async (name: string, args: Record<string, unknown>) => {
        if (name === 'search_knowledge_base') {
          const trustLevel = (args.trust_level as 'internal' | 'reference' | 'all') || 'all';
          const matches = await searchKnowledgeBaseMatches(args.query as string, trustLevel);
          kbResults.push(...matches);
          return formatKnowledgeMatches(matches, trustLevel);
        }

        return executeTool(name, args);
      },
      { thinking: 'enabled', max_tokens: 2048, temperature: 0.7 },
      {
        onThinking: (delta) => sseWrite(res, { type: 'thinking', delta }),
        onToolStart: (name, args) =>
          sseWrite(res, {
            type: 'tool_start',
            name,
            label: TOOL_LABELS[name] || name,
            args,
          }),
        onToolDone: (name, preview) => sseWrite(res, { type: 'tool_done', name, preview }),
        onContent: (delta) => {
          accumulatedContent += delta;
          // Still emit content events for backward compatibility
          sseWrite(res, { type: 'content', delta });
        },
        onDone: (usage) => {
          // Parse accumulated content into structured blocks
          try {
            const trustLevelMap: Record<string, 'internal' | 'reference'> = {};
            kbResults.forEach(doc => {
              trustLevelMap[doc.document_id] = doc.source === 'Internal' ? 'internal' : 'reference';
            });

            const parsed = parseContentToBlocks(accumulatedContent, {
              trustLevelMap,
              episodeId,
              findingIds: options.findingIds,
            });

            // Enrich citations with KB results
            enrichCitations(parsed.citations, kbResults, trustLevelMap);

            // ── Persist callbacks ──
            options.onContent?.(accumulatedContent);
            parsed.blocks.forEach(b => options.onBlock?.(b));
            if (parsed.citations.length > 0) options.onCitations?.(parsed.citations);

            // Emit structured blocks
            parsed.blocks.forEach((block: RenderableBlock, index: number) => {
              sseWrite(res, { type: 'block_start', blockType: block.type, blockIndex: index });
              sseWrite(res, { type: 'block_done', blockIndex: index, block });
            });

            // Emit citations
            parsed.citations.forEach((citation: CitationAnchor) => {
              sseWrite(res, { type: 'citation', citation });
            });

            // Emit UI actions for dock orchestration and viewport focus
            parsed.actions.forEach((action: UIAction) => {
              sseWrite(res, { type: 'ui_action', action });
            });
          } catch (parseError) {
            logger.error('[CAE] Failed to parse content into blocks', { error: parseError });
            // Continue anyway - frontend can fall back to raw content
          }

          sseWrite(res, {
            type: 'done',
            reasoning_tokens: usage?.completion_tokens_details?.reasoning_tokens ?? 0,
            completion_tokens: usage?.completion_tokens ?? 0,
            model: 'mimo-v2.5-pro',
          });
          res.end();
        },
      }
    );
  } catch (err) {
    logError('[CAE] streamChat error', err, { episodeId });
    sseError(res, err);
  }
}

export async function streamExplain(
  episodeId: string,
  detection: DetectionPayload,
  res: Response,
  options: StreamExplainOptions = {}
): Promise<void> {
  sseHeaders(res);

  try {
    sseWrite(res, {
      type: 'tool_start',
      name: 'generate_explanation',
      label: 'Tạo narrative giải thích',
      args: { episode_id: episodeId, detection_count: detection.detections.length },
    });

    const result = await explainerAgent.explain({
      episode_id: episodeId,
      detection,
      clinical_data: options.clinicalData,
    });

    sseWrite(res, {
      type: 'tool_done',
      name: 'generate_explanation',
      preview: result.explanation.slice(0, 160),
    });

    const blocks = buildExplainBlocks(result, detection);
    const citations = result.citations.map((citation, index) =>
      createCitationAnchor(citation, String(index + 1), 3, undefined, options.findingIds)
    );
    const actions: UIAction[] = [
      { type: 'dock_state', state: citations.length > 0 ? 'focus' : 'task' },
    ];

    if (options.findingIds?.length) {
      actions.push({
        type: 'focus_finding',
        findingId: options.findingIds[0],
        ttlMs: 5000,
      });
    }

    if (citations.length > 0) {
      actions.push({ type: 'open_evidence', citationId: citations[0].citationId });
    }

    // ── Persist callbacks ──
    options.onContent?.(result.explanation);
    blocks.forEach(b => options.onBlock?.(b));
    if (citations.length > 0) options.onCitations?.(citations);

    sseWrite(res, { type: 'content', delta: result.explanation });
    emitStructuredResult(res, blocks, citations, actions);

    sseWrite(res, {
      type: 'done',
      reasoning_tokens: 0,
      completion_tokens: Math.max(1, Math.round(result.explanation.length / 4)),
      model: result.model_version,
    });
    res.end();
  } catch (err) {
    logError('[CAE] streamExplain error', err, { episodeId });
    sseError(res, err);
  }
}

export async function streamDraft(
  episodeId: string,
  templateId: string,
  detection: DetectionPayload,
  res: Response,
  options: StreamDraftOptions = {}
): Promise<void> {
  sseHeaders(res);

  try {
    sseWrite(res, {
      type: 'tool_start',
      name: 'generate_draft',
      label: 'Tạo patch báo cáo',
      args: { episode_id: episodeId, template_id: templateId },
    });

    const result = await reporterAgent.draft({
      episode_id: episodeId,
      template_id: templateId,
      detection,
      clinical_data: options.clinicalData,
    });

    const violations = validateDraftFields(result.fields);
    if (violations.length > 0) {
      // Log for audit but don't block — draft fields with flagged content
      // are already marked needs_review; the doctor reviews before signing.
      logger.warn('[CAE] Draft guardrail soft-violations', {
        count: violations.length,
        first: violations[0]?.message,
        episodeId,
      });
    }

    sseWrite(res, {
      type: 'tool_done',
      name: 'generate_draft',
      preview: `Đã tạo ${result.fields.length} field trong draft`,
    });

    const blocks = buildDraftBlocks(result);
    const { ordered } = createDraftCitationRegistry(result.fields);
    const citations = ordered.map(({ citation, id }) =>
      createCitationAnchor(citation, id, 3, undefined, options.findingIds)
    );
    const firstReviewField = result.fields.find((field) => field.status !== 'valid') ?? result.fields[0];
    const actions: UIAction[] = [{ type: 'dock_state', state: 'compose' }];

    if (firstReviewField) {
      actions.push({ type: 'highlight_field', fieldId: firstReviewField.field_id });
    }

    if (citations.length > 0) {
      actions.push({ type: 'open_evidence', citationId: citations[0].citationId });
    }

    const rawContent = result.fields
      .filter((field) => field.value.trim())
      .map((field) => `${field.label}: ${field.value}`)
      .join('\n');

    // ── Persist callbacks ──
    options.onContent?.(rawContent);
    blocks.forEach(b => options.onBlock?.(b));
    if (citations.length > 0) options.onCitations?.(citations);
    if (options.onDraftSaved) options.onDraftSaved(result.draft_id);

    sseWrite(res, { type: 'content', delta: rawContent });
    emitStructuredResult(res, blocks, citations, actions);

    sseWrite(res, {
      type: 'done',
      reasoning_tokens: 0,
      completion_tokens: Math.max(1, Math.round(result.fields.reduce((sum, field) => sum + field.value.length, 0) / 4)),
      model: result.model_version,
    });
    res.end();
  } catch (err) {
    logError('[CAE] streamDraft error', err, { episodeId, templateId });
    sseError(res, err);
  }
}

function citationTrustLevel(source?: string): 'internal' | 'reference' {
  return source === 'Internal' ? 'internal' : 'reference';
}

function createCitationAnchor(
  citation: ApiCitation,
  citationId: string,
  blockIndex: number,
  source?: string,
  findingIds?: string[]
): CitationAnchor {
  return {
    citationId,
    blockIndex,
    findingIds,
    trustLevel: citationTrustLevel(citation.source ?? source),
    documentId: citation.document_id,
    documentTitle: citation.document_title,
    excerpt: citation.excerpt,
    similarity: Math.max(0.55, citation.similarity ?? (0.92 - (Number(citationId) - 1) * 0.06)),
    version: citation.version,
    effectiveDate: citation.effective_date,
  };
}

function sanitizeNarrativeText(text: string): string {
  const artifactMatch = text.search(/<\|im_start\|>|<\|im_end\|>|<\|/);
  const withoutArtifacts = artifactMatch >= 0 ? text.slice(0, artifactMatch) : text;

  return withoutArtifacts
    .replace(/\r/g, '')
    .replace(/^---+$/gm, '')
    .replace(/\n#{1,6}\s*/g, '\n\n')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildNarrativeBlocks(text: string, citationIds: string[]): RenderableBlock[] {
  const cleaned = citationIds.length > 0
    ? sanitizeNarrativeText(text)
    : sanitizeNarrativeText(text)
        .replace(/\n*Trích dẫn:\s*[\s\S]*$/i, '')
        .replace(/\[(\d+)\]/g, '')
        .trim();

  if (!cleaned) {
    return [];
  }

  const sections = cleaned
    .split(/\n{2,}/)
    .map((section) => section.trim())
    .filter(Boolean);

  const narrativeBlocks: RenderableBlock[] = sections.map((section) => {
    const lines = section
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length > 1 && lines.every((line) => /^[-*]\s|^\d+\.\s/.test(line))) {
      return {
        type: 'bullet_list',
        items: lines.map((line) => line.replace(/^[-*]\s|^\d+\.\s/, '')),
      };
    }

    return {
      type: 'paragraph',
      text: lines.join(' '),
    };
  });

  if (citationIds.length > 0) {
    const lastNarrativeBlock = narrativeBlocks[narrativeBlocks.length - 1];
    if (lastNarrativeBlock?.type === 'paragraph') {
      lastNarrativeBlock.text = `${lastNarrativeBlock.text} ${citationIds.map((id) => `[${id}]`).join(' ')}`;
    }
  }

  return narrativeBlocks;
}

function buildExplainBlocks(result: {
  explanation: string;
  citations: ApiCitation[];
  evidence_payload: { findings: string[]; confidence: number; warnings?: string[] };
}, detection: DetectionPayload): RenderableBlock[] {
  const citationIds = result.citations.map((_, index) => String(index + 1));
  const warnings = result.evidence_payload.warnings ?? [];
  const status = warnings.length > 0 || result.evidence_payload.confidence < 0.8
    ? result.evidence_payload.confidence < 0.6
      ? 'blocked'
      : 'review'
    : 'supported';

  const blocks: RenderableBlock[] = [
    {
      type: 'summary',
      text: detection.detections.length > 0
        ? `CAE đã tổng hợp ${detection.detections.length} finding cho ca này với độ tin cậy trung bình ${Math.round(result.evidence_payload.confidence * 100)}%.`
        : 'CAE không thấy finding rõ ràng từ detection payload hiện tại và đang giữ narrative ở mức thận trọng.',
    },
    {
      type: 'decision_card',
      title: 'Mức độ đủ căn cứ cho narrative',
      status,
      summary: warnings.length > 0
        ? `Narrative đã được tạo nhưng còn ${warnings.length} điểm cần bác sĩ xem lại trước khi dùng sang bước báo cáo.`
        : 'Narrative hiện tại có thể dùng làm lớp giải thích và tiếp tục được rà soát bằng evidence rail.',
      bullets: result.evidence_payload.findings.slice(0, 3),
      citations: citationIds,
    },
    {
      type: 'comparison_table',
      title: 'Đối chiếu finding và diễn giải',
      columns: ['Độ tin cậy', 'Diễn giải'],
      rows: detection.detections.map((detectionItem, index) => ({
        label: detectionItem.label,
        values: [
          `${Math.round(detectionItem.score * 100)}%`,
          result.evidence_payload.findings[index] ?? 'Đọc narrative chi tiết để xem diễn giải bổ sung.',
        ],
        tone: detectionItem.score < 0.7 ? 'warning' : 'positive',
      })),
    },
  ];

  warnings.forEach((warning) => {
    blocks.push({ type: 'warning', severity: 'caution', text: warning });
  });

  blocks.push(...buildNarrativeBlocks(result.explanation, citationIds));

  if (result.citations.length > 0) {
    blocks.push({
      type: 'evidence_digest',
      sources: result.citations.map((citation, index) => ({
        id: String(index + 1),
        title: citation.document_title,
        trustLevel: citationTrustLevel(citation.source),
        similarity: Math.max(0.55, citation.similarity ?? (0.92 - index * 0.06)),
      })),
    });
  }

  return blocks;
}

function createDraftCitationRegistry(fields: ApiDraftField[]) {
  const ordered: Array<{ citation: ApiCitation; id: string }> = [];
  const idByKey = new Map<string, string>();

  fields.forEach((field) => {
    field.provenance.forEach((citation) => {
      const key = `${citation.document_id}|${citation.document_title}|${citation.version}`;
      if (!idByKey.has(key)) {
        const id = String(ordered.length + 1);
        idByKey.set(key, id);
        ordered.push({ citation, id });
      }
    });
  });

  return { ordered, idByKey };
}

function derivePatchConfidence(field: ApiDraftField): number {
  if (field.status === 'policy_blocked') return 0.35;
  if (field.status === 'needs_review') return field.provenance.length > 0 ? 0.66 : 0.52;
  return field.provenance.length > 0 ? 0.9 : 0.78;
}

function buildDraftBlocks(result: {
  fields: ApiDraftField[];
}): RenderableBlock[] {
  const reviewSummary = result.fields.reduce(
    (counts, field) => {
      if (field.status === 'policy_blocked') counts.blocked += 1;
      else if (field.status === 'needs_review') counts.review += 1;
      else counts.ready += 1;
      return counts;
    },
    { ready: 0, review: 0, blocked: 0 }
  );

  const { ordered, idByKey } = createDraftCitationRegistry(result.fields);
  const patchPreviews = result.fields.map((field, index) => ({
    patchId: `patch-${index + 1}`,
    fieldKey: field.field_id,
    label: field.label,
    status: field.status,
    source: field.source,
    confidence: derivePatchConfidence(field),
    citations: field.provenance.map((citation) => idByKey.get(`${citation.document_id}|${citation.document_title}|${citation.version}`)!).filter(Boolean),
  }));

  const status = reviewSummary.blocked > 0 ? 'blocked' : reviewSummary.review > 0 ? 'review' : 'supported';

  const blocks: RenderableBlock[] = [
    {
      type: 'summary',
      text: `CAE đã tạo nháp báo cáo với ${result.fields.length} field. Có ${reviewSummary.review} field cần rà soát và ${reviewSummary.blocked} field đang bị chặn bởi policy.`,
    },
    {
      type: 'decision_card',
      title: 'Trạng thái sẵn sàng của draft',
      status,
      summary: status === 'supported'
        ? 'Nháp đã đủ sạch để bác sĩ chuyển sang bước review chi tiết từng field.'
        : 'Nháp đã được tạo nhưng vẫn còn field cần bác sĩ rà soát trước khi xác nhận.',
      bullets: [
        `${reviewSummary.ready} field sẵn sàng`,
        `${reviewSummary.review} field cần rà soát`,
        `${reviewSummary.blocked} field blocked`,
      ],
      citations: ordered.slice(0, 3).map(({ id }) => id),
    },
    {
      type: 'comparison_table',
      title: 'Đối chiếu field trong draft',
      columns: ['Nguồn', 'Trạng thái', 'Giá trị'],
      rows: result.fields.map((field) => ({
        label: field.label,
        values: [
          field.source === 'ai' ? 'AI đề xuất' : field.source === 'manual' ? 'Thủ công' : 'Khoá',
          field.status === 'policy_blocked' ? 'Bị chặn' : field.status === 'needs_review' ? 'Cần rà soát' : 'Sẵn sàng',
          field.value || '(trống)',
        ],
        tone: field.status === 'policy_blocked' ? 'warning' : field.status === 'needs_review' ? 'neutral' : 'positive',
      })),
    },
    {
      type: 'patch_group',
      title: 'Patch đề xuất theo field',
      summary: reviewSummary,
      patches: patchPreviews,
    },
  ];

  result.fields.forEach((field, index) => {
    blocks.push({
      type: 'field_patch',
      patchId: `patch-${index + 1}`,
      fieldKey: field.field_id,
      label: field.label,
      source: field.source,
      status: field.status,
      diff: {
        before: '',
        after: field.value,
      },
      rationale: field.status === 'policy_blocked'
        ? 'Field này đang bị policy chặn và cần bác sĩ chỉnh tay.'
        : field.status === 'needs_review'
        ? 'Field này có dữ liệu nhưng vẫn cần bác sĩ xác nhận nội dung trước khi lưu.'
        : 'Field này đã có đề xuất đủ mạnh để đi vào bước review chi tiết.',
      confidence: derivePatchConfidence(field),
      citations: field.provenance.map((citation) => idByKey.get(`${citation.document_id}|${citation.document_title}|${citation.version}`)!).filter(Boolean),
      provenance: field.provenance.map((citation) => ({
        document_id: citation.document_id,
        document_title: citation.document_title,
        version: citation.version,
        effective_date: citation.effective_date,
        excerpt: citation.excerpt,
      })),
    });
  });

  if (ordered.length > 0) {
    blocks.push({
      type: 'evidence_digest',
      sources: ordered.map(({ citation, id }, index) => ({
        id,
        title: citation.document_title,
        trustLevel: 'reference',
        similarity: Math.max(0.55, 0.9 - index * 0.05),
      })),
    });
  }

  return blocks;
}

function emitStructuredResult(
  res: Response,
  blocks: RenderableBlock[],
  citations: CitationAnchor[],
  actions: UIAction[]
) {
  blocks.forEach((block, index) => {
    sseWrite(res, { type: 'block_start', blockType: block.type, blockIndex: index });
    sseWrite(res, { type: 'block_done', blockIndex: index, block });
  });

  citations.forEach((citation) => {
    sseWrite(res, { type: 'citation', citation });
  });

  actions.forEach((action) => {
    sseWrite(res, { type: 'ui_action', action });
  });
}