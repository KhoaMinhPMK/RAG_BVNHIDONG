/**
 * AI Runs Service
 *
 * Persists every AI invocation (brief, explain, draft, chat, query) to
 * Supabase so results can be restored across tab-switches and page reloads
 * without re-running the LLM.
 *
 * Persistence strategy:
 *   1. createRun()         – INSERT status='streaming', returns run_id
 *   2. appendBlock()       – called per SSE block (fire-and-forget)
 *   3. completeRun()       – UPDATE with final state when stream ends
 *   4. failRun/abortRun()  – UPDATE with error/aborted state
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RunType = 'brief' | 'explain' | 'draft' | 'chat' | 'query';
export type RunStatus = 'streaming' | 'completed' | 'error' | 'aborted';

export interface AiRunInit {
  episode_id: string;
  run_type: RunType;
  finding_ids?: string[];
  created_by?: string | null;
  provider?: string;
  model?: string;
}

export interface AiRunBlock {
  type: string;
  [key: string]: unknown;
}

export interface AiRunComplete {
  blocks: AiRunBlock[];
  raw_content: string;
  citations: unknown[];
  usage?: { completion_tokens?: number; reasoning_tokens?: number; total_tokens?: number } | null;
  draft_ref?: string | null;
  error_msg?: string | null;
}

export interface AiRunRow {
  run_id: string;
  episode_id: string;
  run_type: RunType;
  status: RunStatus;
  blocks: AiRunBlock[];
  raw_content: string;
  citations: unknown[];
  provider: string | null;
  model: string | null;
  usage: unknown | null;
  error_msg: string | null;
  finding_ids: string[];
  draft_ref: string | null;
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
}

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Insert a new ai_runs row with status='streaming'.
 * Returns the generated run_id, or null on failure (non-fatal).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function toUuid(v: string | null | undefined): string | null {
  if (!v) return null;
  return UUID_RE.test(v) ? v : null; // drop dev/mock IDs that aren't real UUIDs
}

export async function createRun(init: AiRunInit): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('ai_runs')
      .insert({
        episode_id:  init.episode_id,
        run_type:    init.run_type,
        status:      'streaming',
        finding_ids: init.finding_ids ?? [],
        created_by:  toUuid(init.created_by),
        provider:    init.provider ?? null,
        model:       init.model ?? null,
        blocks:      [],
        citations:   [],
        raw_content: '',
      })
      .select('run_id')
      .single();

    if (error) {
      logger.warn('[ai-runs] createRun failed (non-fatal)', { error: error.message });
      return null;
    }
    return (data as { run_id: string }).run_id;
  } catch (err) {
    logger.warn('[ai-runs] createRun exception (non-fatal)', { err });
    return null;
  }
}

// ── Incremental block append ──────────────────────────────────────────────────

/**
 * Append a single block to an in-progress run via the RPC stored function.
 * Fire-and-forget — errors are logged but not propagated.
 */
export function appendBlock(run_id: string, block: AiRunBlock): void {
  if (!run_id) return;
  supabase
    .rpc('ai_run_append_block', { p_run_id: run_id, p_block: block as unknown as Record<string, unknown> })
    .then(({ error }) => {
      if (error) logger.warn('[ai-runs] appendBlock failed', { run_id, error: error.message });
    });
}

/**
 * Batch-append multiple blocks in one RPC (useful for flushing a buffer).
 * Falls back to sequential appends if the batch RPC is unavailable.
 */
export async function appendBlocks(run_id: string, blocks: AiRunBlock[]): Promise<void> {
  if (!run_id || blocks.length === 0) return;
  await Promise.all(
    blocks.map((block) =>
      supabase
        .rpc('ai_run_append_block', { p_run_id: run_id, p_block: block as unknown as Record<string, unknown> })
        .then(({ error }) => {
          if (error) logger.warn('[ai-runs] appendBlocks item failed', { run_id, error: error.message });
        })
    )
  );
}

// ── Complete / fail / abort ───────────────────────────────────────────────────

export async function completeRun(run_id: string, params: AiRunComplete): Promise<void> {
  if (!run_id) return;
  try {
    const { error } = await supabase
      .from('ai_runs')
      .update({
        status:       'completed',
        blocks:       params.blocks,
        raw_content:  params.raw_content,
        citations:    params.citations,
        usage:        params.usage ?? null,
        draft_ref:    params.draft_ref ?? null,
        error_msg:    null,
        completed_at: new Date().toISOString(),
      })
      .eq('run_id', run_id);

    if (error) logger.warn('[ai-runs] completeRun failed', { run_id, error: error.message });
  } catch (err) {
    logger.warn('[ai-runs] completeRun exception', { err });
  }
}

export async function failRun(run_id: string, error_msg: string): Promise<void> {
  if (!run_id) return;
  try {
    await supabase
      .from('ai_runs')
      .update({ status: 'error', error_msg, completed_at: new Date().toISOString() })
      .eq('run_id', run_id);
  } catch { /* non-fatal */ }
}

export async function abortRun(run_id: string, partialBlocks?: AiRunBlock[]): Promise<void> {
  if (!run_id) return;
  try {
    const update: Record<string, unknown> = {
      status:       'aborted',
      completed_at: new Date().toISOString(),
    };
    if (partialBlocks && partialBlocks.length > 0) update.blocks = partialBlocks;
    // Guard: only abort if still streaming — never overwrite a completed run
    await supabase
      .from('ai_runs')
      .update(update)
      .eq('run_id', run_id)
      .eq('status', 'streaming');
  } catch { /* non-fatal */ }
}

// ── Query ─────────────────────────────────────────────────────────────────────

/** Returns the most recent completed run of a given type for an episode. */
export async function getLatestRun(
  episode_id: string,
  run_type: RunType,
  maxAgeMs = 30 * 60 * 1000   // default: 30 minutes
): Promise<AiRunRow | null> {
  try {
    const since = new Date(Date.now() - maxAgeMs).toISOString();
    const { data, error } = await supabase
      .from('ai_runs')
      .select('*')
      .eq('episode_id', episode_id)
      .eq('run_type', run_type)
      .eq('status', 'completed')
      .gte('completed_at', since)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data as AiRunRow;
  } catch {
    return null;
  }
}

/** Returns the full run history for an episode (metadata only, no blocks). */
export async function getRunHistory(
  episode_id: string,
  run_type?: RunType,
  limit = 20
): Promise<Partial<AiRunRow>[]> {
  try {
    let q = supabase
      .from('ai_runs')
      .select('run_id, run_type, status, created_at, completed_at, provider, model, usage, error_msg')
      .eq('episode_id', episode_id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (run_type) q = q.eq('run_type', run_type);
    const { data } = await q;
    return (data ?? []) as Partial<AiRunRow>[];
  } catch {
    return [];
  }
}

/** Returns full run content by ID (for restore / replay). */
export async function getRunById(run_id: string): Promise<AiRunRow | null> {
  try {
    const { data, error } = await supabase
      .from('ai_runs')
      .select('*')
      .eq('run_id', run_id)
      .single();

    if (error) return null;
    return data as AiRunRow;
  } catch {
    return null;
  }
}

// ── Draft approval + e-signature ──────────────────────────────────────────────

export interface SignatureData {
  method:    'typed_name';   // future: 'drawn' | 'pki'
  name:      string;         // full name as typed by user
  user_id:   string;
  timestamp: string;         // ISO8601
  ip:        string;
}

export interface ApproveParams {
  draft_id:       string;
  approved_by:    string;    // user UUID
  approval_note?: string;
  signature:      SignatureData;
}

export async function approveDraft(params: ApproveParams): Promise<{ ok: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('draft_reports')
      .update({
        status:          'approved',
        approved_by:     params.approved_by,
        approved_at:     new Date().toISOString(),
        approval_note:   params.approval_note ?? null,
        signature_data:  params.signature,
        updated_at:      new Date().toISOString(),
      })
      .eq('id', params.draft_id)
      .in('status', ['draft', 'under_review', 'edited']); // only approvable states

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// ── Query result persistence ──────────────────────────────────────────────────

export interface SaveQueryParams {
  episode_id?:  string | null;
  run_id?:      string | null;
  query_text:   string;
  answer:       string;
  sources:      unknown[];
  created_by?:  string | null;
}

export async function saveQueryResult(params: SaveQueryParams): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('query_results')
      .insert({
        episode_id:  params.episode_id ?? null,
        run_id:      params.run_id ?? null,
        query_text:  params.query_text,
        answer:      params.answer,
        sources:     params.sources,
        created_by:  toUuid(params.created_by),
      })
      .select('query_id')
      .single();

    if (error) {
      logger.warn('[ai-runs] saveQueryResult failed', { error: error.message });
      return null;
    }
    return (data as { query_id: string }).query_id;
  } catch {
    return null;
  }
}
