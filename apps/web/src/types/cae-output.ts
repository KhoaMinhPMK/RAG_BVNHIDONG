/**
 * CAE Structured Output Types
 *
 * Frontend copy of backend types for CAE structured responses.
 * Keep in sync with apps/api/src/types/cae-output.ts
 */

// ============================================================================
// Renderable Blocks
// ============================================================================

export type RenderableBlock =
  | SummaryBlock
  | ParagraphBlock
  | BulletListBlock
  | WarningBlock
  | TableBlock
  | EvidenceDigestBlock
  | FieldPatchBlock;

export interface SummaryBlock {
  type: 'summary';
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
}

export interface BulletListBlock {
  type: 'bullet_list';
  items: string[];
}

export interface WarningBlock {
  type: 'warning';
  severity: 'info' | 'caution' | 'high';
  text: string;
}

export interface TableBlock {
  type: 'table';
  columns: string[];
  rows: string[][];
}

export interface EvidenceDigestBlock {
  type: 'evidence_digest';
  sources: Array<{
    id: string;
    title: string;
    trustLevel: 'internal' | 'reference';
    similarity: number;
  }>;
}

export interface FieldPatchBlock {
  type: 'field_patch';
  patchId: string;
  fieldKey: string;
  diff: {
    before: string;
    after: string;
  };
  rationale: string;
  confidence: number;
  citations: string[];
}

// ============================================================================
// Citation Anchors
// ============================================================================

export interface CitationAnchor {
  citationId: string;
  blockIndex: number;
  sentenceRange?: [number, number];
  findingIds?: string[];
  trustLevel: 'internal' | 'reference';
  documentId: string;
  documentTitle: string;
  excerpt: string;
  similarity: number;
  version?: string;
  effectiveDate?: string;
}

// ============================================================================
// UI Actions
// ============================================================================

export type UIAction =
  | DockStateAction
  | FocusFindingAction
  | HighlightFieldAction
  | OpenEvidenceAction
  | RestoreViewAction;

export interface DockStateAction {
  type: 'dock_state';
  state: 'peek' | 'task' | 'focus' | 'compose';
}

export interface FocusFindingAction {
  type: 'focus_finding';
  findingId: string;
  zoom?: number;
  ttlMs?: number;
}

export interface HighlightFieldAction {
  type: 'highlight_field';
  fieldId: string;
}

export interface OpenEvidenceAction {
  type: 'open_evidence';
  citationId: string;
}

export interface RestoreViewAction {
  type: 'restore_view';
  target?: 'previous' | 'default';
}

// ============================================================================
// CAE Response
// ============================================================================

export interface CAEResponse {
  blocks: RenderableBlock[];
  citations: CitationAnchor[];
  actions?: UIAction[];
  metadata: {
    model: string;
    provider: 'ollama' | 'mimo';
    reasoning_tokens?: number;
    completion_tokens: number;
    latency_ms: number;
  };
}

// ============================================================================
// SSE Event Types (for streaming)
// ============================================================================

export type CAESSEEvent =
  | ThinkingEvent
  | ToolStartEvent
  | ToolDoneEvent
  | BlockStartEvent
  | BlockContentEvent
  | BlockDoneEvent
  | CitationEvent
  | UIActionEvent
  | ContentEvent  // Legacy, for backward compatibility
  | DoneEvent
  | ErrorEvent;

export interface ThinkingEvent {
  type: 'thinking';
  delta: string;
}

export interface ToolStartEvent {
  type: 'tool_start';
  name: string;
  label: string;
  args: Record<string, unknown>;
}

export interface ToolDoneEvent {
  type: 'tool_done';
  name: string;
  preview: string;
}

export interface BlockStartEvent {
  type: 'block_start';
  blockType: RenderableBlock['type'];
  blockIndex: number;
}

export interface BlockContentEvent {
  type: 'block_content';
  blockIndex: number;
  delta: string | Record<string, unknown>;
}

export interface BlockDoneEvent {
  type: 'block_done';
  blockIndex: number;
  block: RenderableBlock;
}

export interface CitationEvent {
  type: 'citation';
  citation: CitationAnchor;
}

export interface UIActionEvent {
  type: 'ui_action';
  action: UIAction;
}

export interface ContentEvent {
  type: 'content';
  delta: string;
}

export interface DoneEvent {
  type: 'done';
  reasoning_tokens?: number;
  completion_tokens: number;
  model: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}
