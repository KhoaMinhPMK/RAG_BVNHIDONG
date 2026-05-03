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
import type { RenderableBlock, CitationAnchor } from '../types/cae-output.js';

export type CAESSEEvent =
  | { type: 'thinking'; delta: string }
  | { type: 'tool_start'; name: string; label: string; args: Record<string, unknown> }
  | { type: 'tool_done'; name: string; preview: string }
  | { type: 'content'; delta: string }
  | { type: 'block_start'; blockType: string; blockIndex: number }
  | { type: 'block_done'; blockIndex: number; block: RenderableBlock }
  | { type: 'citation'; citation: CitationAnchor }
  | { type: 'done'; reasoning_tokens: number; completion_tokens: number; model: string }
  | { type: 'error'; message: string };

function sseWrite(res: Response, event: CAESSEEvent) {
  if (res.writableEnded) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
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
    .select('patient_ref, age, gender, chief_complaint, vitals, lab_results, findings, status, created_at')
    .eq('id', episodeId)
    .single();

  if (error || !data) {
    return `Không tìm thấy bệnh nhân với episode_id=${episodeId}`;
  }

  return JSON.stringify(
    {
      patient_ref: data.patient_ref,
      age: data.age,
      gender: data.gender,
      chief_complaint: data.chief_complaint,
      vitals: data.vitals,
      lab_results: data.lab_results,
      findings: data.findings,
      status: data.status,
    },
    null,
    2
  );
}

async function searchKnowledgeBase(
  query: string,
  trustLevel: 'internal' | 'reference' | 'all' = 'all'
): Promise<string> {
  try {
    const { embeddingClient } = await import('../lib/embedding/client.js');
    const { embedding } = await embeddingClient.generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_document_chunks', {
      query_embedding: embedding,
      match_threshold: 0.4,
      match_count: 6,
    });

    if (error || !data?.length) {
      return 'Không tìm thấy tài liệu liên quan trong knowledge base.';
    }

    let chunks = data as Array<{
      document_id: string;
      document_title: string;
      content: string;
      similarity: number;
    }>;

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
      return `Không có tài liệu ${trustLevel === 'internal' ? 'nội bộ' : 'tham khảo'} phù hợp.`;
    }

    const docIds = [...new Set(chunks.map((c) => c.document_id))];
    const { data: docsInfo } = await supabase
      .from('documents')
      .select('id, source, title')
      .in('id', docIds);
    const sourceMap = Object.fromEntries((docsInfo || []).map((d) => [d.id, d.source]));

    return chunks
      .map((c) => {
        const src = sourceMap[c.document_id] || 'Unknown';
        const badge = src === 'Internal' ? '[Noi bo]' : '[Tham khao]';
        return `${badge} ${c.document_title} (similarity: ${(c.similarity * 100).toFixed(1)}%)\n${c.content.slice(0, 600)}`;
      })
      .join('\n\n---\n\n');
  } catch (err) {
    return `Lỗi tìm kiếm: ${err instanceof Error ? err.message : String(err)}`;
  }
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

QUYEN HAN CUA BAN:
- Doc va phan tich toan bo du lieu benh nhan.
- Tra cuu knowledge base, uu tien tai lieu noi bo.
- Phan tich pattern lam sang va X-quang.
- De xuat chan doan vi phan co can cu + trich dan nguon.
- Soan nhap bao cao can bac si review.

GIOI HAN TUYET DOI:
- KHONG dua ra chan doan cuoi cung.
- KHONG ke don thuoc.
- KHONG ghi vao ho so chinh thuc.
- KHONG quyet dinh phac do dieu tri.

NGUYEN TAC LAM VIEC:
1. Luon dung cong cu de lay data thuc te truoc khi phan tich.
2. Tai lieu noi bo (Internal) duoc uu tien cao hon tham khao ngoai.
3. Neu co mau thuan giua cac nguon, neu ro su xung dot va uu tien nguon noi bo.
4. Luon neu ro muc do tin cay va nguon goc cua moi khuyen nghi.
5. Phong cach: chuyen nghiep, suc tich, khong ruom ra.

Khi phan tich ca benh, hay:
- Nhan xet cac bat thuong trong vitals/labs.
- Lien ket voi findings X-quang.
- De xuat chan doan vi phan theo thu tu kha nang.
- Neu ro buoc can bac si xac nhan.`;
}

export async function streamBrief(episodeId: string, res: Response): Promise<void> {
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
        const result = await executeTool(name, args);

        // Capture KB results for citation enrichment
        if (name === 'search_knowledge_base' && result) {
          try {
            const parsed = JSON.parse(result);
            if (Array.isArray(parsed)) {
              kbResults.push(...parsed);
            }
          } catch {
            // Not JSON, skip
          }
        }

        return result;
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
            });

            // Enrich citations with KB results
            enrichCitations(parsed.citations, kbResults, trustLevelMap);

            // Emit structured blocks
            parsed.blocks.forEach((block: RenderableBlock, index: number) => {
              sseWrite(res, { type: 'block_start', blockType: block.type, blockIndex: index });
              sseWrite(res, { type: 'block_done', blockIndex: index, block });
            });

            // Emit citations
            parsed.citations.forEach((citation: CitationAnchor) => {
              sseWrite(res, { type: 'citation', citation });
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
    logger.error('[CAE] streamBrief error', { error: err, episodeId });
    sseWrite(res, {
      type: 'error',
      message: err instanceof Error ? err.message : 'CAE error',
    });
    res.end();
  }
}

export async function streamChat(
  episodeId: string,
  userMessages: Array<{ role: 'user' | 'assistant'; content: string }>,
  res: Response
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
        const result = await executeTool(name, args);

        // Capture KB results for citation enrichment
        if (name === 'search_knowledge_base' && result) {
          try {
            const parsed = JSON.parse(result);
            if (Array.isArray(parsed)) {
              kbResults.push(...parsed);
            }
          } catch {
            // Not JSON, skip
          }
        }

        return result;
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
            });

            // Enrich citations with KB results
            enrichCitations(parsed.citations, kbResults, trustLevelMap);

            // Emit structured blocks
            parsed.blocks.forEach((block: RenderableBlock, index: number) => {
              sseWrite(res, { type: 'block_start', blockType: block.type, blockIndex: index });
              sseWrite(res, { type: 'block_done', blockIndex: index, block });
            });

            // Emit citations
            parsed.citations.forEach((citation: CitationAnchor) => {
              sseWrite(res, { type: 'citation', citation });
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
    logger.error('[CAE] streamChat error', { error: err, episodeId });
    sseWrite(res, {
      type: 'error',
      message: err instanceof Error ? err.message : 'CAE error',
    });
    res.end();
  }
}