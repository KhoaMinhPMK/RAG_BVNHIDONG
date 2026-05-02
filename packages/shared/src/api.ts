import { z } from 'zod';

/**
 * API request/response schemas
 * Theo architect review: OpenAPI source of truth
 */

// ============= RAG Query API =============

export const RAGQueryRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  filters: z.object({
    sources: z.array(z.enum(['WHO', 'BTS', 'BYT', 'PubMed', 'Internal'])).optional(),
    dateRange: z.object({
      from: z.string().date(),
      to: z.string().date(),
    }).optional(),
    ageGroup: z.string().optional(),
    language: z.enum(['vi', 'en']).optional(),
  }).optional(),
  maxResults: z.number().int().min(1).max(20).default(5),
  userRole: z.enum(['clinician', 'radiologist', 'researcher', 'admin']),
});

export const CitationSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string(),
  version: z.string(),
  source: z.string(),
  page: z.number().int().optional(),
  section: z.string().optional(),
  excerpt: z.string(),
  relevance: z.number().min(0).max(1),
});

export const RetrievedChunkSchema = z.object({
  chunkId: z.string().uuid(),
  content: z.string(),
  document: z.object({
    id: z.string().uuid(),
    title: z.string(),
    version: z.string(),
    source: z.string(),
  }),
  metadata: z.object({
    page: z.number().int().optional(),
    section: z.string().optional(),
  }).optional(),
  similarity: z.number().min(0).max(1),
});

export const RAGQueryResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema),
  chunks: z.array(RetrievedChunkSchema),
  metadata: z.object({
    model: z.string(),
    retrievalTime: z.number().int(), // milliseconds
    generationTime: z.number().int(),
    totalTime: z.number().int(),
    citationsVerified: z.boolean(),
  }),
  warnings: z.array(z.string()).optional(), // Cảnh báo nếu có
});

// ============= Explainer Agent API =============

export const ExplainRequestSchema = z.object({
  detectionResult: z.object({
    image_id: z.string(),
    detections: z.array(z.object({
      label: z.string(),
      score: z.number(),
      bbox: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })),
  }),
  patientContext: z.object({
    age: z.number().int().optional(),
    symptoms: z.array(z.string()).optional(),
  }).optional(),
  userRole: z.enum(['clinician', 'radiologist', 'researcher', 'admin']),
});

export const ExplainResponseSchema = z.object({
  explanation: z.string(),
  findings: z.array(z.object({
    label: z.string(),
    severity: z.enum(['mild', 'moderate', 'severe', 'unknown']),
    description: z.string(),
    citations: z.array(CitationSchema),
  })),
  recommendations: z.array(z.string()).optional(), // Chỉ gợi ý, không phải y lệnh
  metadata: z.object({
    model: z.string(),
    totalTime: z.number().int(),
  }),
  warnings: z.array(z.string()).optional(),
});

// ============= Reporter Agent API =============

export const DraftReportRequestSchema = z.object({
  templateId: z.string().uuid(),
  patientData: z.object({
    patientRef: z.string(), // Anonymized ID
    age: z.number().int(),
    clinicalData: z.record(z.unknown()),
  }),
  detectionResult: z.object({
    image_id: z.string(),
    detections: z.array(z.unknown()),
  }),
  userRole: z.enum(['clinician', 'radiologist', 'researcher', 'admin']),
});

export const DraftReportResponseSchema = z.object({
  draft: z.string(),
  template: z.object({
    id: z.string().uuid(),
    name: z.string(),
    version: z.string(),
  }),
  citations: z.array(CitationSchema),
  metadata: z.object({
    model: z.string(),
    totalTime: z.number().int(),
    requiresApproval: z.boolean().default(true),
  }),
  warnings: z.array(z.string()).optional(),
});

// ============= Document Upload API =============

export const DocumentUploadRequestSchema = z.object({
  title: z.string(),
  version: z.string(),
  source: z.enum(['WHO', 'BTS', 'BYT', 'PubMed', 'Internal', 'Other']),
  effectiveDate: z.string().date(),
  expiryDate: z.string().date().nullable(),
  owner: z.string(),
  ageGroup: z.string().nullable(),
  language: z.enum(['vi', 'en']),
  accessLevel: z.enum(['public', 'clinician', 'radiologist', 'researcher', 'admin']),
  file: z.instanceof(File).or(z.string()), // File object hoặc base64
});

export const DocumentUploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(['pending', 'indexing', 'completed', 'failed']),
  chunksCreated: z.number().int().optional(),
  message: z.string(),
});

// ============= Health Check API =============

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  services: z.object({
    database: z.object({
      status: z.enum(['up', 'down']),
      latency: z.number().optional(),
    }),
    ollama: z.object({
      status: z.enum(['up', 'down']),
      model: z.string().optional(),
      latency: z.number().optional(),
    }),
    embedding: z.object({
      status: z.enum(['up', 'down']),
      model: z.string().optional(),
      latency: z.number().optional(),
    }),
  }),
  timestamp: z.string().datetime(),
});

// Export types
export type RAGQueryRequest = z.infer<typeof RAGQueryRequestSchema>;
export type RAGQueryResponse = z.infer<typeof RAGQueryResponseSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type RetrievedChunk = z.infer<typeof RetrievedChunkSchema>;
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;
export type DraftReportRequest = z.infer<typeof DraftReportRequestSchema>;
export type DraftReportResponse = z.infer<typeof DraftReportResponseSchema>;
export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequestSchema>;
export type DocumentUploadResponse = z.infer<typeof DocumentUploadResponseSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
