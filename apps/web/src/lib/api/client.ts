/**
 * API Client - Frontend → Backend Communication
 *
 * Handles all API calls to the backend Express server.
 * Automatically includes JWT token from Supabase session.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// ============================================================================
// Simple in-memory cache (avoids redundant fetches on tab switches)
// ============================================================================
interface CacheEntry<T> { data: T; ts: number; }
const _cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.ts > ttlMs) { _cache.delete(key); return null; }
  return entry.data;
}
function cacheSet<T>(key: string, data: T) {
  _cache.set(key, { data, ts: Date.now() });
}
export function invalidateCache(pattern?: string) {
  if (!pattern) { _cache.clear(); return; }
  for (const key of _cache.keys()) {
    if (key.includes(pattern)) _cache.delete(key);
  }
}

// ============================================================================
// Types (matching backend API contract)
// ============================================================================

interface ApiError {
  code: string;
  message: string;
  details?: any;
}

interface ApiResponse<T> {
  success: boolean;
  error?: ApiError;
  [key: string]: any;
}

// ============================================================================
// Helper: Get current user's JWT token
// ============================================================================

// 🚨 TEMPORARY: Hardcoded JWT token for testing (remove in production)
const MOCK_JWT_TOKEN = process.env.NEXT_PUBLIC_MOCK_JWT_TOKEN;

export async function getAuthToken(): Promise<string | null> {
  // If mock token is provided, use it (for testing without auth)
  if (MOCK_JWT_TOKEN) {
    return MOCK_JWT_TOKEN;
  }

  try {
    const { createClient } = await import('@/lib/supabase/client');
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('Failed to get auth token:', error);
    return null;
  }
}

/** Headers for JSON POST (e.g. CAE SSE) including Bearer JWT when logged in. */
export async function jsonAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// Core API call function
// ============================================================================

async function apiCall<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add auth token if available
  const token = await getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          code: 'NETWORK_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error,
      };
    }

    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`API call failed: ${method} ${endpoint}`, error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    };
  }
}

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * POST /api/query - Knowledge Agent
 */
export async function queryKnowledge(
  query: string,
  episodeId?: string,
  provider?: 'ollama' | 'mimo'
) {
  return apiCall<{
    answer: string;
    citations: Array<{
      document_id: string;
      document_title: string;
      version: string;
      effective_date: string;
      excerpt: string;
    }>;
    model_version: string;
    timestamp: string;
    status: 'success' | 'insufficient_evidence' | 'out_of_scope';
  }>('/api/query', {
    method: 'POST',
    body: { query, episode_id: episodeId, provider: provider || 'mimo' },
  });
}

/**
 * POST /api/explain - Explainer Agent
 */
export async function explainDetection(
  episodeId: string,
  detection: {
    image_id: string;
    detections: Array<{
      bbox: [number, number, number, number];
      label: string;
      score: number;
    }>;
  },
  clinicalData?: Record<string, any>
) {
  return apiCall<{
    explanation: string;
    citations: Array<any>;
    evidence_payload: {
      findings: string[];
      confidence: number;
      warnings?: string[];
    };
    model_version: string;
    timestamp: string;
  }>('/api/explain', {
    method: 'POST',
    body: {
      episode_id: episodeId,
      detection,
      clinical_data: clinicalData,
    },
  });
}

/**
 * POST /api/draft - Reporter Agent
 */
export async function generateDraft(
  episodeId: string,
  templateId: string,
  detection: {
    image_id: string;
    detections: Array<{
      bbox: [number, number, number, number];
      label: string;
      score: number;
    }>;
  },
  clinicalData?: Record<string, any>
) {
  return apiCall<{
    draft_id: string;
    template_id: string;
    episode_id: string;
    fields: Array<{
      field_id: string;
      label: string;
      value: string;
      source: 'ai' | 'manual' | 'locked';
      provenance: Array<any>;
      status: 'valid' | 'needs_review' | 'policy_blocked';
    }>;
    status: 'draft';
    model_version: string;
    timestamp: string;
  }>('/api/draft', {
    method: 'POST',
    body: {
      episode_id: episodeId,
      template_id: templateId,
      detection,
      clinical_data: clinicalData,
    },
  });
}

/**
 * GET /health - Health check (public)
 */
export async function checkHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await response.json();
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Episodes API
// ============================================================================

export type EpisodeStatus =
  | 'pending_detection'
  | 'pending_explain'
  | 'pending_draft'
  | 'pending_approval'
  | 'completed';

export interface Episode {
  id: string;
  episode_id?: string;
  patient_ref: string;
  age?: string;
  gender?: string;
  date?: string;
  admission_date?: string;
  symptoms?: string;
  spo2?: string;
  crp?: string;
  findings: string[];
  status: EpisodeStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EpisodeListResponse {
  episodes: Episode[];
  total: number;
  page: number;
  limit: number;
}

export interface EpisodeDetailResponse {
  episode: Episode;
  images: Array<{
    id: string;
    episode_id: string;
    image_url: string;
    image_type: string;
    uploaded_at: string;
  }>;
  detection_result?: {
    id: string;
    episode_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result?: any;
    error?: string;
    created_at: string;
    completed_at?: string;
  };
}

/**
 * GET /api/documents - List knowledge base documents (cached 2 min)
 */
export async function getDocuments() {
  const key = 'documents_list';
  const cached = cacheGet<Awaited<ReturnType<typeof apiCall>>>(key, 2 * 60_000);
  if (cached) return cached as Awaited<ReturnType<typeof getDocuments>>;
  const result = await apiCall<{
    documents: Array<{
      id: string;
      title: string;
      version?: string;
      source?: string;
      status: string;
      chunk_count: number;
      effective_date?: string;
      created_at?: string;
    }>;
    total: number;
  }>('/api/documents', { method: 'GET' });
  if (result) cacheSet(key, result);
  return result;
}

/**
 * POST /api/documents/upload - Upload PDF + auto embedding pipeline
 * Uses multipart/form-data (NOT JSON) — bypasses apiCall helper
 */
export async function uploadDocument(params: {
  file: File;
  title?: string;
  source?: string;
  effective_date?: string;
  trust_level?: 'internal' | 'reference';
}) {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.title) formData.append('title', params.title);
  if (params.source) formData.append('source', params.source);
  if (params.effective_date) formData.append('effective_date', params.effective_date);
  if (params.trust_level) formData.append('trust_level', params.trust_level);

  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      return {
        success: false as const,
        error: data.error || { code: 'UPLOAD_FAILED', message: `HTTP ${response.status}` },
      };
    }
    invalidateCache('documents_list'); // force fresh list after upload
    return data as {
      success: true;
      job_id: string;
      status: 'processing';
      message: string;
    };
  } catch (error) {
    return {
      success: false as const,
      error: { code: 'NETWORK_ERROR', message: error instanceof Error ? error.message : 'Upload failed' },
    };
  }
}

/**
 * GET /api/documents/jobs/:jobId - Read ingestion job progress
 */
export interface DocumentIngestionJobResponse {
  job: {
    id: string;
    file_path: string;
    status: 'pending' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed';
    progress: number;
    total_chunks?: number;
    processed_chunks?: number;
    error?: string;
    message?: string;
    document_id?: string;
    result?: {
      success: boolean;
      document_id: string;
      chunks_created: number;
      embeddings_created: number;
      total_tokens: number;
      duration_ms: number;
      error?: string;
    };
    started_at: string;
    completed_at?: string;
  };
}

export async function getDocumentIngestionJob(jobId: string) {
  return apiCall<DocumentIngestionJobResponse>(`/api/documents/jobs/${jobId}`, { method: 'GET' });
}

/**
 * DELETE /api/documents/:id - Delete a document and its chunks
 */
export async function deleteDocument(id: string) {
  return apiCall<{ document_id: string }>(`/api/documents/${id}`, { method: 'DELETE' });
}

/**
 * GET /health - Full system health including LLM + embedding status
 */
export async function getSystemHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    return data as {
      success: boolean;
      status: 'ok' | 'degraded' | 'error';
      services: {
        supabase: { status: string };
        cae: { status: string; provider?: string; model?: string };
        ollama: { status: string; model: string };
        mimo: { status: string; model: string };
        embedding: { status: string; model: string; dim: number };
      };
    };
  } catch {
    return {
      success: false,
      status: 'error' as const,
      services: {
        supabase: { status: 'disconnected' },
        cae: { status: 'disconnected', provider: '', model: '' },
        ollama: { status: 'disconnected', model: '' },
        mimo: { status: 'disconnected', model: '' },
        embedding: { status: 'disconnected', model: '', dim: 0 },
      },
    };
  }
}

/**
 * GET /api/episodes - List episodes with pagination
 */
export async function getEpisodes(params?: {
  status?: EpisodeStatus;
  page?: number;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const query = queryParams.toString();
  const endpoint = query ? `/api/episodes?${query}` : '/api/episodes';

  return apiCall<EpisodeListResponse>(endpoint, { method: 'GET' });
}

/**
 * GET /api/episodes/:id - Get episode detail (cached 5 min)
 */
export async function getEpisodeDetail(episodeId: string) {
  const key = `episode_${episodeId}`;
  const cached = cacheGet<EpisodeDetailResponse>(key, 5 * 60_000);
  if (cached) return cached;
  const result = await apiCall<EpisodeDetailResponse>(`/api/episodes/${episodeId}`, { method: 'GET' });
  if (result) cacheSet(key, result);
  return result;
}

/**
 * POST /api/episodes - Create new episode
 */
export async function createEpisode(data: {
  patient_ref: string;
  age?: string;
  gender?: string;
  date: string;
  symptoms?: string;
  spo2?: string;
  crp?: string;
}) {
  return apiCall<{ episode: Episode }>('/api/episodes', {
    method: 'POST',
    body: data,
  });
}

/**
 * PATCH /api/episodes/:id - Update episode
 */
export async function updateEpisode(
  episodeId: string,
  data: {
    status?: EpisodeStatus;
    findings?: string[];
  }
) {
  return apiCall<{ episode: Episode }>(`/api/episodes/${episodeId}`, {
    method: 'PATCH',
    body: data,
  });
}

// ============================================================================
// AI Runs
// ============================================================================

export interface AiRunBlock { type: string; [key: string]: unknown; }

export interface AiRunRow {
  run_id: string;
  episode_id: string;
  run_type: 'brief' | 'explain' | 'draft' | 'chat' | 'query';
  status: 'streaming' | 'completed' | 'error' | 'aborted';
  blocks: AiRunBlock[];
  raw_content: string;
  citations: unknown[];
  provider: string | null;
  model: string | null;
  usage: unknown | null;
  error_msg: string | null;
  finding_ids: string[];
  draft_ref: string | null;
  created_at: string;
  completed_at: string | null;
}

/**
 * GET /api/ai-runs/latest — fetch most recent completed run for restore
 * Returns null if no run found within maxAgeMin (default 30 min)
 */
export async function getLatestAiRun(
  episodeId: string,
  type: AiRunRow['run_type'],
  maxAgeMin = 30
): Promise<AiRunRow | null> {
  const key = `ai_run_${episodeId}_${type}`;
  const cached = cacheGet<AiRunRow>(key, maxAgeMin * 60_000);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      episode_id: episodeId,
      type,
      max_age_min: String(maxAgeMin),
    });
    const result = await apiCall<{ run: AiRunRow | null }>(
      `/api/ai-runs/latest?${params.toString()}`,
      { method: 'GET' }
    );
    if (result?.run) {
      cacheSet(key, result.run);
      return result.run;
    }
    return null;
  } catch {
    return null;
  }
}

/** GET /api/ai-runs — list run history (metadata only) */
export async function getAiRunHistory(
  episodeId: string,
  type?: AiRunRow['run_type'],
  limit = 20
): Promise<Partial<AiRunRow>[]> {
  const params = new URLSearchParams({ episode_id: episodeId, limit: String(limit) });
  if (type) params.append('type', type);
  try {
    const result = await apiCall<{ runs: Partial<AiRunRow>[] }>(
      `/api/ai-runs?${params.toString()}`,
      { method: 'GET' }
    );
    return result?.runs ?? [];
  } catch {
    return [];
  }
}

/**
 * POST /api/drafts/:draft_id/approve — BS xác nhận + e-signature
 */
export async function approveDraft(params: {
  draft_id: string;
  signature_name: string;
  approval_note?: string;
}): Promise<{ ok: boolean; approved_at?: string; error?: string }> {
  try {
    const result = await apiCall<{ approved_at: string }>(
      `/api/drafts/${params.draft_id}/approve`,
      {
        method: 'POST',
        body: {
          signature_name: params.signature_name,
          approval_note:  params.approval_note,
        },
      }
    );
    return { ok: true, approved_at: result?.approved_at };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Approval failed' };
  }
}

/** Invalidate cached ai run (e.g. after a new run completes) */
export function invalidateAiRunCache(episodeId: string, type?: string) {
  invalidateCache(type ? `ai_run_${episodeId}_${type}` : `ai_run_${episodeId}`);
}

// ─── Draft Report restore ──────────────────────────────────────────────────

export interface DraftReportRow {
  draft_id: string;
  episode_id: string;
  template_id: string;
  fields: Array<{ field_id: string; label?: string; value: unknown; source?: string; status?: string; provenance?: unknown[] }>;
  status: 'draft' | 'under_review' | 'edited' | 'approved' | 'rejected' | 'archived';
  model_version: string | null;
  run_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_note: string | null;
  signature_data: unknown | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/drafts/latest?episode_id= — latest draft for episode (for restore on page load)
 */
export async function getLatestDraft(episodeId: string): Promise<DraftReportRow | null> {
  const key = `draft_${episodeId}`;
  const cached = cacheGet<DraftReportRow>(key, 10 * 60_000); // 10-min cache
  if (cached) return cached;

  try {
    const result = await apiCall<{ draft: DraftReportRow | null }>(
      `/api/ai-runs/drafts/latest?episode_id=${encodeURIComponent(episodeId)}`,
      { method: 'GET' }
    );
    if (result?.draft) {
      cacheSet(key, result.draft);
      return result.draft;
    }
    return null;
  } catch {
    return null;
  }
}

export function invalidateDraftCache(episodeId: string) {
  invalidateCache(`draft_${episodeId}`);
}

