/**
 * RAG Ingestion Pipeline - Type Definitions
 *
 * Defines types for document ingestion, chunking, and embedding.
 */

// ============================================================================
// Document Types
// ============================================================================

export interface DocumentMetadata {
  title: string;
  version: string;
  effective_date: string;
  source: string;
  document_type: 'guideline' | 'protocol' | 'research' | 'reference';
  specialty?: string;
  tags?: string[];
  authors?: string[];
  institution?: string;
}

export interface ParsedDocument {
  content: string;
  metadata: DocumentMetadata;
  page_count?: number;
  word_count?: number;
}

// ============================================================================
// Chunking Types
// ============================================================================

export interface ChunkMetadata {
  document_id: string;
  chunk_index: number;
  total_chunks: number;
  start_page?: number;
  end_page?: number;
  section_title?: string;
  token_count: number;
}

export interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface ChunkingOptions {
  max_tokens: number;
  overlap_tokens: number;
  preserve_sentences: boolean;
  preserve_paragraphs: boolean;
}

// ============================================================================
// Embedding Types
// ============================================================================

export interface EmbeddingRequest {
  text: string;
  model?: string;
}

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  token_count: number;
}

export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
  batch_size?: number;
}

export interface BatchEmbeddingResponse {
  embeddings: number[][];
  model: string;
  total_tokens: number;
  failed_indices?: number[];
}

// ============================================================================
// Ingestion Types
// ============================================================================

export interface IngestionJob {
  id: string;
  file_path: string;
  status: 'pending' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'completed' | 'failed';
  progress: number;
  total_chunks?: number;
  processed_chunks?: number;
  error?: string;
  started_at: Date;
  completed_at?: Date;
}

export interface IngestionResult {
  success: boolean;
  document_id: string;
  chunks_created: number;
  embeddings_created: number;
  total_tokens: number;
  duration_ms: number;
  error?: string;
}

export interface IngestionOptions {
  chunking?: Partial<ChunkingOptions>;
  embedding_model?: string;
  batch_size?: number;
  skip_existing?: boolean;
}

// ============================================================================
// Database Types (matching Supabase schema)
// ============================================================================

export interface DocumentRow {
  id: string;
  title: string;
  version: string;
  effective_date: string;
  source: string;
  document_type: 'guideline' | 'protocol' | 'research' | 'reference';
  specialty?: string;
  content_hash: string;
  page_count?: number;
  word_count?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunkRow {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  token_count: number;
  metadata?: Record<string, any>;
  created_at: string;
}

// ============================================================================
// Search Types
// ============================================================================

export interface VectorSearchOptions {
  query_embedding: number[];
  match_threshold?: number;
  match_count?: number;
  filter?: {
    document_type?: string[];
    specialty?: string;
    effective_date_after?: string;
  };
}

export interface VectorSearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
  metadata: {
    document_title: string;
    document_version: string;
    effective_date: string;
    chunk_index: number;
  };
}
