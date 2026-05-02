import { supabase } from '../lib/supabase/client.js';
import { logger } from '../utils/logger.js';
import type { Role } from '../types/api.js';

interface AuditLogEntry {
  user_id?: string;
  user_role: Role;
  action: string;
  episode_id?: string;
  draft_id?: string;
  details?: Record<string, any>;
}

/**
 * Audit Logger - Log all important actions for traceability
 * Based on yeu_cau_he_thong_rag.md Section 8 (MED-08: Auditability)
 */
export class AuditLogger {
  /**
   * Log an action to audit_logs table
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from('audit_logs').insert({
        event_id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user_id: entry.user_id || 'system',
        user_role: entry.user_role,
        action: entry.action,
        episode_id: entry.episode_id,
        draft_id: entry.draft_id,
        details: entry.details,
      });

      if (error) {
        logger.error('Audit log insert failed', { error: error.message, entry });
      } else {
        logger.debug('Audit log recorded', { action: entry.action });
      }
    } catch (err) {
      logger.error('Audit log exception', { error: err, entry });
    }
  }

  /**
   * Log query action
   */
  async logQuery(
    userId: string,
    userRole: Role,
    query: string,
    status: string,
    episodeId?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'query:knowledge',
      episode_id: episodeId,
      details: {
        query: query.slice(0, 200), // Truncate for storage
        status,
      },
    });
  }

  /**
   * Log explain action
   */
  async logExplain(
    userId: string,
    userRole: Role,
    episodeId: string,
    detectionCount: number
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'explain:detection',
      episode_id: episodeId,
      details: {
        detection_count: detectionCount,
      },
    });
  }

  /**
   * Log draft creation
   */
  async logDraftCreate(
    userId: string,
    userRole: Role,
    episodeId: string,
    draftId: string,
    templateId: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'draft:create',
      episode_id: episodeId,
      draft_id: draftId,
      details: {
        template_id: templateId,
      },
    });
  }

  /**
   * Log draft edit
   */
  async logDraftEdit(
    userId: string,
    userRole: Role,
    episodeId: string,
    draftId: string,
    changes: any
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'draft:edit',
      episode_id: episodeId,
      draft_id: draftId,
      details: {
        changes,
      },
    });
  }

  /**
   * Log draft approval
   */
  async logDraftApprove(
    userId: string,
    userRole: Role,
    episodeId: string,
    draftId: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'draft:approve',
      episode_id: episodeId,
      draft_id: draftId,
      details: {},
    });
  }

  /**
   * Log draft rejection
   */
  async logDraftReject(
    userId: string,
    userRole: Role,
    episodeId: string,
    draftId: string,
    reason: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'draft:reject',
      episode_id: episodeId,
      draft_id: draftId,
      details: {
        reason,
      },
    });
  }

  /**
   * Log feedback submission
   */
  async logFeedback(
    userId: string,
    userRole: Role,
    episodeId: string,
    action: string,
    comment?: string
  ): Promise<void> {
    await this.log({
      user_id: userId,
      user_role: userRole,
      action: 'feedback:submit',
      episode_id: episodeId,
      details: {
        feedback_action: action,
        comment,
      },
    });
  }

  /**
   * Get audit trail for episode
   */
  async getEpisodeAudit(episodeId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('episode_id', episodeId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Audit trail retrieval error', { error: error.message, episodeId });
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Audit trail retrieval exception', { error: err });
      return [];
    }
  }

  /**
   * Get audit trail for draft
   */
  async getDraftAudit(draftId: string, limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('draft_id', draftId)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Draft audit trail retrieval error', { error: error.message, draftId });
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Draft audit trail retrieval exception', { error: err });
      return [];
    }
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();

/**
 * Express middleware to auto-log requests
 */
export function auditMiddleware() {
  return (req: any, res: any, next: any) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to log after response
    res.json = (body: any) => {
      // Log successful actions
      if (body.success !== false) {
        const userRole = req.userRole || 'clinician';
        const userId = req.userId || 'anonymous';

        // Auto-log based on path
        if (req.path.includes('/query')) {
          auditLogger.logQuery(userId, userRole, req.body.query, body.status, req.body.episode_id);
        } else if (req.path.includes('/explain')) {
          auditLogger.logExplain(userId, userRole, req.body.episode_id, req.body.detection?.detections?.length || 0);
        } else if (req.path.includes('/draft') && req.method === 'POST') {
          auditLogger.logDraftCreate(userId, userRole, req.body.episode_id, body.draft_id, req.body.template_id);
        }
      }

      return originalJson(body);
    };

    next();
  };
}
