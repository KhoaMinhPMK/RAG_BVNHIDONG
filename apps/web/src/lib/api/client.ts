/**
 * API Client - Frontend → Backend Communication
 *
 * Handles all API calls to the backend Express server.
 * Automatically includes JWT token from Supabase session.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

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

async function getAuthToken(): Promise<string | null> {
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

// ============================================================================
// Core API call function
// ============================================================================

async function apiCall<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
  episodeId?: string
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
    body: { query, episode_id: episodeId },
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
 * GET /api/episodes/:id - Get episode detail
 */
export async function getEpisodeDetail(episodeId: string) {
  return apiCall<EpisodeDetailResponse>(`/api/episodes/${episodeId}`, {
    method: 'GET',
  });
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

