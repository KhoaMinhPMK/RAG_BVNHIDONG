/**
 * Report Versioning Service
 *
 * Creates immutable version snapshots for draft_reports.
 * Uses content hash to avoid duplicate saves when content hasn't changed.
 */

import { createHash } from 'crypto';
import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';

export type VersionAction =
  | 'ai_generated'
  | 'user_edited'
  | 'submitted_for_review'
  | 'approved'
  | 'rejected'
  | 'superseded'
  | 'forked';

export interface CreateVersionInput {
  draftId: string;
  blocks: unknown[];
  citationSnapshot: unknown[];
  action: VersionAction;
  actionBy: string;
  actionNote?: string;
  sessionId?: string;
  modelId?: string;
  policyVersion?: string;
}

/**
 * Create a new version snapshot. Returns the version number assigned.
 * Skips if the content hash matches the previous version (idempotent).
 */
export async function createReportVersion(input: CreateVersionInput): Promise<number> {
  // Get current max version
  const { data: latest } = await supabase
    .from('report_versions')
    .select('version, blocks')
    .eq('draft_id', input.draftId)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const currentVersion = latest?.version ?? 0;
  const newVersion = currentVersion + 1;

  // Dedup: skip if blocks haven't changed
  if (latest?.blocks) {
    const prevHash = createHash('sha256').update(JSON.stringify(latest.blocks)).digest('hex');
    const newHash = createHash('sha256').update(JSON.stringify(input.blocks)).digest('hex');
    if (prevHash === newHash && input.action === 'user_edited') {
      logger.info('[Versioning] Skipped duplicate version (no content change)', {
        draftId: input.draftId,
        version: currentVersion,
      });
      return currentVersion;
    }
  }

  const { error } = await supabase.from('report_versions').insert({
    draft_id: input.draftId,
    version: newVersion,
    blocks: input.blocks as any,
    citation_snapshot: input.citationSnapshot as any,
    action: input.action,
    action_by: input.actionBy,
    action_note: input.actionNote ?? null,
    session_id: input.sessionId ?? null,
    model_id: input.modelId ?? null,
    policy_version: input.policyVersion ?? null,
  });

  if (error) {
    logger.error('[Versioning] Failed to create version', { draftId: input.draftId, error: error.message });
    throw new Error(`Không thể tạo phiên bản: ${error.message}`);
  }

  // Update draft's current_version counter
  await supabase
    .from('draft_reports')
    .update({ current_version: newVersion })
    .eq('draft_id', input.draftId);

  logger.info('[Versioning] Version created', {
    draftId: input.draftId,
    version: newVersion,
    action: input.action,
  });

  return newVersion;
}

/**
 * Get version history for a draft.
 */
export async function getVersionHistory(draftId: string) {
  const { data, error } = await supabase
    .from('report_versions')
    .select('id, version, action, action_by, action_note, model_id, created_at')
    .eq('draft_id', draftId)
    .order('version', { ascending: false });

  if (error) {
    throw new Error(`Lỗi đọc lịch sử phiên bản: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Get a specific version's full content (blocks + citations).
 */
export async function getVersionContent(draftId: string, version: number) {
  const { data, error } = await supabase
    .from('report_versions')
    .select('*')
    .eq('draft_id', draftId)
    .eq('version', version)
    .single();

  if (error || !data) {
    throw new Error(`Không tìm thấy phiên bản ${version}`);
  }

  return data;
}
