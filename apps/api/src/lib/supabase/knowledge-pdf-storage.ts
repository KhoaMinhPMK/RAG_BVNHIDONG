/**
 * Upload original PDF bytes to Supabase Storage after successful ingest,
 * so GET /api/documents/:id/source works without local disk on other hosts.
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { supabase } from './client.js';
import { logger } from '../utils/logger.js';

export function getKnowledgePdfStorageBucket(): string {
  return (process.env.KNOWLEDGE_PDF_STORAGE_BUCKET || 'knowledge-pdfs').trim();
}

export function isKnowledgePdfStorageUploadEnabled(): boolean {
  return process.env.KNOWLEDGE_PDF_STORAGE_ENABLED !== 'false';
}

function storageObjectPath(documentId: string, originalOrBasename: string): string {
  const base = path.basename(originalOrBasename);
  const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'source.pdf';
  return `${documentId}/${safe}`;
}

/**
 * Reads local PDF, uploads to bucket, merges storage keys into documents.metadata.
 * Throws on failure so caller can log; ingestion may still be considered successful without storage.
 */
export async function uploadKnowledgeSourcePdfAfterIngest(
  documentId: string,
  localFilePath: string,
  originalName?: string
): Promise<void> {
  if (!isKnowledgePdfStorageUploadEnabled()) {
    return;
  }

  const bucket = getKnowledgePdfStorageBucket();
  const objectPath = storageObjectPath(
    documentId,
    (originalName && originalName.trim()) || localFilePath
  );

  const buf = await readFile(localFilePath);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(objectPath, buf, {
    contentType: 'application/pdf',
    upsert: true,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: row, error: selectError } = await supabase
    .from('documents')
    .select('metadata')
    .eq('id', documentId)
    .single();

  if (selectError) {
    throw new Error(selectError.message);
  }

  const meta = (row?.metadata as Record<string, unknown> | null | undefined) ?? {};

  const { error: updateError } = await supabase
    .from('documents')
    .update({
      metadata: {
        ...meta,
        source_pdf_storage_bucket: bucket,
        source_pdf_storage_path: objectPath,
      },
    })
    .eq('id', documentId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  logger.info('Knowledge PDF stored in Supabase Storage', { documentId, bucket, objectPath });
}

export function getStoragePdfLocationFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): { bucket: string; objectPath: string; originalName?: string } | null {
  const m = metadata ?? {};
  const bucket = m.source_pdf_storage_bucket;
  const objectPath = m.source_pdf_storage_path;
  if (typeof bucket !== 'string' || !bucket.trim() || typeof objectPath !== 'string' || !objectPath.trim()) {
    return null;
  }
  const originalName =
    typeof m.source_artifact_original_name === 'string' ? m.source_artifact_original_name : undefined;
  return { bucket: bucket.trim(), objectPath: objectPath.trim(), originalName };
}

export async function removeKnowledgeSourcePdfFromStorage(
  metadata: Record<string, unknown> | null | undefined
): Promise<void> {
  const loc = getStoragePdfLocationFromMetadata(metadata);
  if (!loc) {
    return;
  }

  const { error } = await supabase.storage.from(loc.bucket).remove([loc.objectPath]);
  if (error) {
    logger.warn('Failed to remove knowledge PDF from storage', {
      bucket: loc.bucket,
      objectPath: loc.objectPath,
      error: error.message,
    });
  }
}
