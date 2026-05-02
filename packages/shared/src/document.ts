import { z } from 'zod';

/**
 * Document metadata schema
 * Theo yêu cầu RAG-D-05: phiên bản hóa tài liệu
 */

export const DocumentStatusSchema = z.enum(['draft', 'active', 'superseded', 'retired']);

export const DocumentSourceSchema = z.enum(['WHO', 'BTS', 'BYT', 'PubMed', 'Internal', 'Other']);

export const DocumentMetadataSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  version: z.string(),
  source: DocumentSourceSchema,
  effective_date: z.string().date(),
  expiry_date: z.string().date().nullable(),
  owner: z.string(), // Chủ sở hữu chuyên môn
  approved_by: z.string().nullable(),
  age_group: z.string().nullable(), // 'pediatric', 'adult', 'all'
  status: DocumentStatusSchema,
  language: z.enum(['vi', 'en']),
  access_level: z.enum(['public', 'clinician', 'radiologist', 'researcher', 'admin']),
  file_url: z.string().url().nullable(),
  checksum: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const ChunkMetadataSchema = z.object({
  id: z.string().uuid(),
  document_id: z.string().uuid(),
  chunk_index: z.number().int().nonnegative(),
  content: z.string(),
  // embedding sẽ được lưu trong database, không cần trong TypeScript
  metadata: z.object({
    page: z.number().int().optional(),
    section: z.string().optional(),
    heading: z.string().optional(),
    tokens: z.number().int().optional(),
  }).optional(),
  effective_date: z.string().date(),
  expiry_date: z.string().date().nullable(),
  created_at: z.string().datetime(),
});

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type DocumentSource = z.infer<typeof DocumentSourceSchema>;
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;
export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;
