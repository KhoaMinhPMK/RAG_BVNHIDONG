import { randomUUID } from 'crypto';

import type { IngestionJob, IngestionProgressUpdate, IngestionResult } from './types.js';

export interface IngestionJobRecord extends IngestionJob {
  document_id?: string;
  message?: string;
  result?: IngestionResult;
  updated_at: Date;
}

class IngestionJobStore {
  private readonly jobs = new Map<string, IngestionJobRecord>();
  private readonly maxJobs = 200;

  createJob(filePath: string): IngestionJobRecord {
    const now = new Date();
    const job: IngestionJobRecord = {
      id: randomUUID(),
      file_path: filePath,
      status: 'pending',
      progress: 0,
      started_at: now,
      updated_at: now,
    };

    this.prune();
    this.jobs.set(job.id, job);
    return job;
  }

  getJob(jobId: string): IngestionJobRecord | null {
    return this.jobs.get(jobId) ?? null;
  }

  updateJob(jobId: string, update: Partial<IngestionJobRecord>): IngestionJobRecord | null {
    const existing = this.jobs.get(jobId);

    if (!existing) {
      return null;
    }

    const nextJob: IngestionJobRecord = {
      ...existing,
      ...update,
      updated_at: new Date(),
      completed_at:
        update.status === 'completed' || update.status === 'failed'
          ? update.completed_at ?? new Date()
          : existing.completed_at,
    };

    this.jobs.set(jobId, nextJob);
    return nextJob;
  }

  applyProgress(jobId: string, update: IngestionProgressUpdate): IngestionJobRecord | null {
    return this.updateJob(jobId, {
      status: update.status,
      progress: update.progress,
      total_chunks: update.total_chunks,
      processed_chunks: update.processed_chunks,
      document_id: update.document_id,
      message: update.message,
      error: update.status === 'failed' ? update.message : undefined,
    });
  }

  completeJob(jobId: string, result: IngestionResult): IngestionJobRecord | null {
    return this.updateJob(jobId, {
      status: result.success ? 'completed' : 'failed',
      progress: result.success ? 100 : 0,
      document_id: result.document_id || undefined,
      error: result.error,
      result,
    });
  }

  failJob(jobId: string, message: string): IngestionJobRecord | null {
    return this.updateJob(jobId, {
      status: 'failed',
      error: message,
      message,
      progress: 0,
    });
  }

  private prune(): void {
    if (this.jobs.size < this.maxJobs) {
      return;
    }

    const orderedJobs = Array.from(this.jobs.values()).sort(
      (left, right) => left.updated_at.getTime() - right.updated_at.getTime()
    );

    const overflow = this.jobs.size - this.maxJobs + 1;
    for (const job of orderedJobs.slice(0, overflow)) {
      this.jobs.delete(job.id);
    }
  }
}

export const ingestionJobStore = new IngestionJobStore();