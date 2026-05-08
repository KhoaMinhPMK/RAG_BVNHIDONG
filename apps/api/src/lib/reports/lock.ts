/**
 * Report Lock Service
 *
 * Concurrent edit detection via optimistic locking.
 * Lock expires automatically after 10 minutes (enforced in DB).
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';

export interface LockStatus {
  acquired: boolean;
  lockedBy: string | null;
  expiresAt: string | null;
}

/**
 * Try to acquire a lock for a draft report.
 * Uses the Supabase RPC `acquire_report_lock` which handles race conditions atomically.
 */
export async function acquireLock(draftId: string, userId: string): Promise<LockStatus> {
  const { data, error } = await supabase.rpc('acquire_report_lock', {
    p_draft_id: draftId,
    p_user_id: userId,
  });

  if (error) {
    logger.error('[Lock] acquire failed', { draftId, userId, error: error.message });
    throw new Error(`Không thể lấy khóa chỉnh sửa: ${error.message}`);
  }

  return {
    acquired: (data as any).acquired as boolean,
    lockedBy: (data as any).locked_by as string | null,
    expiresAt: (data as any).expires_at as string | null,
  };
}

/**
 * Release a lock held by a specific user.
 */
export async function releaseLock(draftId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('report_locks')
    .delete()
    .eq('draft_id', draftId)
    .eq('locked_by', userId);

  if (error) {
    logger.warn('[Lock] release failed (non-critical)', { draftId, userId, error: error.message });
  }
}

/**
 * Check current lock status without acquiring.
 */
export async function checkLock(draftId: string): Promise<LockStatus> {
  const { data, error } = await supabase
    .from('report_locks')
    .select('locked_by, locked_at, expires_at')
    .eq('draft_id', draftId)
    .single();

  if (error?.code === 'PGRST116') {
    // No lock row found
    return { acquired: false, lockedBy: null, expiresAt: null };
  }

  if (error) {
    throw new Error(`Lỗi kiểm tra khóa: ${error.message}`);
  }

  // Check if expired
  if (data && new Date(data.expires_at) < new Date()) {
    // Expired — clean up
    await supabase.from('report_locks').delete().eq('draft_id', draftId);
    return { acquired: false, lockedBy: null, expiresAt: null };
  }

  return {
    acquired: true,
    lockedBy: data?.locked_by ?? null,
    expiresAt: data?.expires_at ?? null,
  };
}
