/**
 * API Types - Shared contract between Frontend and Backend
 * Source of truth for API communication
 */

// ============================================================================
// Common Types
// ============================================================================

export type Role = 'clinician' | 'radiologist' | 'researcher' | 'admin';

export type FieldSource = 'ai' | 'manual' | 'locked';

export type FieldStatus = 'valid' | 'needs_review' | 'policy_blocked';

export type DraftStatus = 'draft' | 'under_review' | 'edited' | 'approved' | 'rejected' | 'archived';

export type EpisodeStatus = 'pending_detection' | 'pending_explain' | 'pending_draft' | 'pending_approval' | 'completed' | 'archived';

export type ErrorCode =
  | 'INSUFFICIENT_EVIDENCE'
  | 'OUT_OF_SCOPE'
  | 'POLICY_BLOCKED'
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

// ============================================================================
// Detection Schema (Input for Explainer/Reporter)
// ============================================================================

export interface Detection {
  bbox: [number, number, number, number]; // [x1, y1, x2, y2]
  label: string; // "Consolidation" | "Pleural effusion" | ...
  score: number; // 0-1
}

export interface DetectionPayload {
  image_id: string;
  detections: Detection[];
  model_version?: string;
  timestamp?: string;
}

// ============================================================================
// Detection Status (Polling)
// ============================================================================

export interface DetectionStatusResponse {
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  results?: {
    model_version: string;
    detections: Array<{
      label: string;
      confidence: number;
      bbox: [number, number, number, number];
      location: string;
    }>;
    findings: string[];
    severity: string;
    timestamp: string;
  };
  error?: string;
  created_at: string;
  completed_at?: string;
}

// ============================================================================
// Citation Schema
// ============================================================================

export interface Citation {
  document_id: string;
  document_title: string;
  version: string;
  effective_date: string;
  excerpt: string;
  page?: number;
  url?: string;
  status?: 'active' | 'superseded' | 'retired';
}

// ============================================================================
// Knowledge Query (S02)
// ============================================================================

export interface QueryRequest {
  query: string;
  role: Role;
  episode_id?: string;
}

export interface QueryResponse {
  answer: string;
  citations: Citation[];
  model_version: string;
  timestamp: string;
  uncertainty?: number;
  status: 'success' | 'insufficient_evidence' | 'out_of_scope';
}

// ============================================================================
// Explainer Agent (S03)
// ============================================================================

export interface ExplainRequest {
  episode_id: string;
  detection: DetectionPayload;
  clinical_data?: Record<string, any>;
}

export interface ExplainResponse {
  explanation: string;
  citations: Citation[];
  evidence_payload: {
    findings: string[];
    confidence: number;
    warnings?: string[];
  };
  model_version: string;
  timestamp: string;
}

// ============================================================================
// Reporter Agent (S05)
// ============================================================================

export interface DraftField {
  field_id: string;
  label: string;
  value: string;
  source: FieldSource;
  provenance: Citation[];
  status: FieldStatus;
  changed?: boolean;
}

export interface DraftReportRequest {
  episode_id: string;
  template_id: string;
  detection: DetectionPayload;
  clinical_data?: Record<string, any>;
}

export interface DraftReportResponse {
  draft_id: string;
  template_id: string;
  episode_id: string;
  fields: DraftField[];
  status: DraftStatus;
  model_version: string;
  timestamp: string;
  warnings?: string[];
}

// ============================================================================
// Episode (S03)
// ============================================================================

export interface PatientContext {
  episode_id: string;
  patient_ref: string;
  age: string;
  gender: string;
  admission_date: string;
  chief_complaint: string;
  vital_signs?: Record<string, any>;
  lab_results?: Record<string, any>;
}

export interface Episode {
  episode_id: string;
  patient_ref: string;
  age: string;
  gender: string;
  admission_date: string;
  status: EpisodeStatus;
  findings: string[];
  chief_complaint?: string;
  vital_signs?: Record<string, any>;
  lab_results?: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface EpisodeListRequest {
  status?: EpisodeStatus;
  limit?: number;
  offset?: number;
}

export interface EpisodeListResponse {
  episodes: Episode[];
  total: number;
  hasMore: boolean;
}

export interface EpisodeDetailResponse {
  episode: Episode;
  images?: Array<{
    image_id: string;
    file_name: string;
    storage_path: string;
    uploaded_at: string;
  }>;
  detection_results?: {
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: number;
    results?: DetectionPayload;
  };
}

export interface CreateEpisodeRequest {
  patient_ref: string;
  age: string;
  gender: string;
  admission_date: string;
  chief_complaint?: string;
  vital_signs?: Record<string, any>;
  lab_results?: Record<string, any>;
}

export interface UpdateEpisodeRequest {
  status?: EpisodeStatus;
  findings?: string[];
  chief_complaint?: string;
  vital_signs?: Record<string, any>;
  lab_results?: Record<string, any>;
}

export interface EpisodeResponse {
  episode: PatientContext;
  detection?: DetectionPayload;
  clinical_data?: Record<string, any>;
}

// ============================================================================
// Templates (S04)
// ============================================================================

export interface ReportTemplate {
  template_id: string;
  name: string;
  version: string;
  intended_use: string;
  approved_by: string;
  effective_date: string;
  status: 'active' | 'draft' | 'retired';
  schema: {
    fields: Array<{
      field_id: string;
      label: string;
      type: 'text' | 'textarea' | 'select' | 'number';
      required: boolean;
      editable: boolean;
    }>;
  };
}

export interface TemplatesResponse {
  templates: ReportTemplate[];
}

// ============================================================================
// Audit (S10)
// ============================================================================

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  user_id: string;
  user_role: Role;
  action: string;
  episode_id?: string;
  draft_id?: string;
  details?: Record<string, any>;
}

export interface AuditResponse {
  events: AuditEvent[];
  total: number;
}

// ============================================================================
// Feedback
// ============================================================================

export interface FeedbackRequest {
  episode_id: string;
  draft_id?: string;
  action: 'accept' | 'edit' | 'reject' | 'report_error';
  comment?: string;
}

export interface FeedbackResponse {
  success: boolean;
  log_id: string;
}

// ============================================================================
// Error Response
// ============================================================================

export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
}

// ============================================================================
// Success Response Wrapper
// ============================================================================

export type ApiResponse<T> =
  | ({ success: true } & T)
  | ErrorResponse;
