---
noteId: "67277a90456511f1b3ce19fa7351e6bb"
tags: []

---

# RAG Ingestion Pipeline — Backend Implementation Plan

**Document ID:** BE-RAG-INGESTION-001  
**Date:** 2026-05-01  
**Author:** agentFE  
**Assignee:** agentBE  
**Priority:** HIGH (Foundation cho toàn bộ RAG system)

---

## 🎯 Mục tiêu

Xây dựng pipeline để ingest tài liệu y khoa (PDF/Markdown) vào hệ thống RAG:
```
PDF/Markdown → Parse → Chunk → Embed → Insert Database → Vector Search
```

**Kết quả cuối cùng:**
- 2 PDF documents (PERCH + VinDr) → database
- Knowledge Agent dùng vector search thay vì text search
- CLI tool để ingest thêm tài liệu mới

---

## 📋 Scope

### ✅ Trong phạm vi (Phase 1-5)
1. PDF Parser (2 documents đã có)
2. Text Chunking (semantic, 512 tokens, 50 overlap)
3. Embedding Generation (Ollama nomic-embed-text, 768 dims)
4. Database Insertion (documents + chunks tables)
5. CLI Tool (ingest single file hoặc folder)
6. Update Knowledge Agent (switch to vector search)
7. End-to-end testing

### ❌ Ngoài phạm vi (Phase 2)
1. Markdown Parser (web scraped docs)
2. Table/Figure extraction từ PDF
3. Document Management UI
4. Incremental re-ingestion
5. RAG quality monitoring dashboard

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLI Tool                                  │
│  apps/api/src/scripts/ingest-documents.ts                    │
│  Usage: node dist/scripts/ingest-documents.js --file X.pdf   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Ingestion Service                            │
│  apps/api/src/lib/ingestion/service.ts                       │
│  Flow: parse → chunk → embed → insert                       │
└─────────────────────────────────────────────────────────────┘
                │                    │                    │
                ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   PDF Parser     │  │    Chunker       │  │ Embedding Client │
│ pdf-parser.ts    │  │  chunker.ts      │  │ client.ts        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                                                   │
                                                   ▼
                                          ┌──────────────────┐
                                          │   Ollama API     │
                                          │ nomic-embed-text │
                                          │ http://localhost:│
                                          │ 11434            │
                                          └──────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + pgvector)          │
│  tables: documents, chunks                                   │
│  function: match_chunks(query_embedding, threshold, count)  │
└─────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│              Knowledge Agent (updated)                       │
│  apps/api/src/agents/knowledge.ts                            │
│  Switch: textSearch → vector similarity (match_chunks)      │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Files Structure

### Files mới (8 files)
```
apps/api/src/
├── lib/
│   ├── ingestion/
│   │   ├── pdf-parser.ts          # PDF text extraction
│   │   ├── chunker.ts             # Text chunking logic
│   │   ├── service.ts             # Main ingestion orchestrator
│   │   └── types.ts               # TypeScript interfaces
│   ├── embedding/
│   │   ├── client.ts              # Ollama embedding API wrapper
│   │   └── batch.ts               # Batch processing with rate limiting
│   └── utils/
│       └── tokenizer.ts           # Token counting helper
└── scripts/
    └── ingest-documents.ts        # CLI tool
```

### Files sửa đổi (2 files)
```
apps/api/src/
├── agents/knowledge.ts            # Switch to vector search
├── package.json                   # Add dependencies
```

---

## 🔧 Dependencies

### Node packages
```json
{
  "dependencies": {
    "pdf-parse": "^1.1.1",
    "marked": "^11.0.0",
    "gray-matter": "^4.0.3",
    "tiktoken": "^1.0.0",
    "cli-progress": "^3.12.0",
    "@types/cli-progress": "^3.11.5",
    "@types/pdf-parse": "^1.1.4"
  }
}
```

### Ollama
- Model: `nomic-embed-text` (768 dimensions)
- Command setup: `ollama pull nomic-embed-text`
- Size: ~500MB

---

## 📋 Step-by-Step Implementation

### STEP 1: Environment Setup (15 phút)

**Task:**
```bash
# 1. Pull Ollama embedding model
ollama pull nomic-embed-text

# 2. Verify model loaded
ollama list

# 3. Test embedding generation
curl http://localhost:11434/api/embeddings \
  -d '{"model": "nomic-embed-text", "prompt": "test"}'

# 4. Install dependencies
cd apps/api
npm install pdf-parse marked gray-matter tiktoken cli-progress
npm install --save-dev @types/pdf-parse @types/cli-progress

# 5. Verify .env has OLLAMA_URL
# Expected: http://localhost:11434
```

**Success Criteria:**
- ✅ `ollama list` shows `nomic-embed-text:latest`
- ✅ `curl` test returns array of 768 floats
- ✅ Dependencies installed (check package.json)
- ✅ OLLAMA_URL in .env

---

### STEP 2: Create Types & Interfaces (15 phút)

**File:** `apps/api/src/lib/ingestion/types.ts`

```typescript
// ============================================================================
// Document Types
// ============================================================================

export interface ParsedDocument {
  text: string;
  metadata: DocumentMetadata;
  sourceType: 'pdf' | 'markdown';
}

export interface DocumentMetadata {
  title: string;
  author?: string;
  source: string; // 'WHO', 'BTS', 'PubMed', etc.
  pages?: number;
  creationDate?: Date;
  language?: 'vi' | 'en';
  tags?: string[];
}

// ============================================================================
// Chunk Types
// ============================================================================

export interface Chunk {
  content: string;
  chunkIndex: number;
  tokens: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  startChar: number;
  endChar: number;
  section?: string;
  heading?: string;
}

export interface ChunkConfig {
  maxTokens: number;
  overlapTokens: number;
}

export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxTokens: 512,
  overlapTokens: 50,
};

// ============================================================================
// Embedding Types
// ============================================================================

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
}

// ============================================================================
// Ingestion Types
// ============================================================================

export interface IngestionResult {
  documentId: string;
  title: string;
  chunkCount: number;
  embeddingCount: number;
  duration: number; // ms
  errors: IngestionError[];
}

export interface IngestionError {
  type: 'parse' | 'chunk' | 'embed' | 'insert';
  message: string;
  details?: unknown;
}

export interface IngestionOptions {
  source: string;
  effectiveDate?: Date;
  status?: 'draft' | 'active' | 'superseded' | 'retired';
  language?: 'vi' | 'en';
  accessLevel?: 'public' | 'clinician' | 'radiologist' | 'researcher' | 'admin';
  owner?: string;
  version?: string;
}

export const DEFAULT_INGESTION_OPTIONS: IngestionOptions = {
  source: 'Internal',
  effectiveDate: new Date(),
  status: 'active',
  language: 'en',
  accessLevel: 'clinician',
  owner: 'system',
  version: '1.0',
};
```

**Validation:**
```bash
# Compile check
npx tsc --noEmit apps/api/src/lib/ingestion/types.ts
```

---

### STEP 3: Create PDF Parser (30-45 phút)

**File:** `apps/api/src/lib/ingestion/pdf-parser.ts`

```typescript
import pdf from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { ParsedDocument, DocumentMetadata } from './types';

/**
 * Extract title from PDF filename
 * Format: 03_PERCH_study_deep_learning_pediatric_CXR_Chen_2021.pdf
 */
function extractTitleFromFilename(filePath: string): string {
  const basename = path.basename(filePath, '.pdf');
  // Remove leading number prefix (01_, 02_, etc.)
  return basename.replace(/^\d+_/, '').replace(/_/g, ' ');
}

/**
 * Parse PDF file and extract text + metadata
 */
export async function parsePDF(filePath: string): Promise<ParsedDocument> {
  try {
    const dataBuffer = await fs.readFile(filePath);

    const pdfData = await pdf(dataBuffer);

    const metadata: DocumentMetadata = {
      title: pdfData.info?.Title || extractTitleFromFilename(filePath),
      author: pdfData.info?.Author,
      source: extractSourceFromMetadata(pdfData.info),
      pages: pdfData.numpages,
      creationDate: parsePdfDate(pdfData.info?.CreationDate),
      language: 'en', // Default for medical papers
      tags: [],
    };

    return {
      text: cleanExtractedText(pdfData.text),
      metadata,
      sourceType: 'pdf',
    };
  } catch (error) {
    throw new Error(`Failed to parse PDF ${filePath}: ${error.message}`);
  }
}

/**
 * Clean extracted text (remove artifacts, normalize whitespace)
 */
function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\f/g, '\n') // Form feeds to newlines
    .replace(/[^\S\n]+/g, ' ') // Multiple spaces to single
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines to double
    .trim();
}

/**
 * Parse PDF date string to JS Date
 */
function parsePdfDate(dateStr?: string): Date | undefined {
  if (!dateStr) return undefined;

  // PDF date format: D:20210101120000+00'00'
  const match = dateStr.match(/^D:(\d{4})(\d{2})(\d{2})/);
  if (match) {
    return new Date(`${match[1]}-${match[2]}-${match[3]}`);
  }

  return new Date(dateStr);
}

/**
 * Extract source from PDF metadata
 */
function extractSourceFromMetadata(info?: any): string {
  if (!info) return 'Internal';

  const title = (info.Title || '').toLowerCase();
  const author = (info.Author || '').toLowerCase();
  const subject = (info.Subject || '').toLowerCase();

  if (title.includes('who') || author.includes('world health')) return 'WHO';
  if (title.includes('bts') || author.includes('british thoracic')) return 'BTS';
  if (title.includes('fleischner')) return 'PubMed';
  if (title.includes('perch') || title.includes('vindr')) return 'PubMed';

  return 'Internal';
}
```

**Test:**
```typescript
// apps/api/src/lib/ingestion/__tests__/pdf-parser.test.ts
import { parsePDF } from '../pdf-parser';

async function testParsePDF() {
  const filePath = 'knowledge_base/downloads/03_PERCH_study_deep_learning_pediatric_CXR_Chen_2021.pdf';
  const doc = await parsePDF(filePath);

  console.log('✅ Parsed PDF:', doc.metadata.title);
  console.log('📄 Pages:', doc.metadata.pages);
  console.log('📝 Text length:', doc.text.length);
  console.log('🏷️ Source:', doc.metadata.source);

  // Verify text quality
  const nonEmptyLines = doc.text.split('\n').filter(line => line.trim().length > 0);
  console.log('📊 Non-empty lines:', nonEmptyLines.length);

  return doc;
}

testParsePDF().catch(console.error);
```

**Expected Output:**
```
✅ Parsed PDF: PERCH Study deep learning pediatric CXR Chen 2021
📄 Pages: 12
📝 Text length: 45,230
🏷️ Source: PubMed
📊 Non-empty lines: 850
```

---

### STEP 4: Create Tokenizer Helper (15 phút)

**File:** `apps/api/src/lib/utils/tokenizer.ts`

```typescript
import { encoding_for_model, Tiktoken } from 'tiktoken';

let encoder: Tiktoken | null = null;

function getEncoder(): Tiktoken {
  if (!encoder) {
    encoder = encoding_for_model('gpt-3.5-turbo');
  }
  return encoder;
}

/**
 * Count tokens in text
 */
export function countTokens(text: string): number {
  const enc = getEncoder();
  return enc.encode(text).length;
}

/**
 * Get last N tokens from text
 */
export function getLastNTokens(text: string, n: number): string {
  const enc = getEncoder();
  const tokens = enc.encode(text);
  const lastTokens = tokens.slice(-n);
  return enc.decode(lastTokens);
}

/**
 * Free encoder resources (call at end of program)
 */
export function freeEncoder(): void {
  if (encoder) {
    encoder.free();
    encoder = null;
  }
}
```

**Test:**
```bash
node -e "
const { countTokens, getLastNTokens } = require('./dist/lib/utils/tokenizer.js');
const text = 'Triệu chứng viêm phổi ở trẻ em';
console.log('Tokens:', countTokens(text));
console.log('Last 5 tokens:', getLastNTokens(text, 5));
"
```

---

### STEP 5: Create Chunker (45 phút)

**File:** `apps/api/src/lib/ingestion/chunker.ts`

```typescript
import { Chunk, ChunkConfig, DEFAULT_CHUNK_CONFIG } from './types';
import { countTokens, getLastNTokens } from '../utils/tokenizer';

/**
 * Split text into chunks based on tokens
 */
export async function chunkText(
  text: string,
  config: ChunkConfig = DEFAULT_CHUNK_CONFIG
): Promise<Chunk[]> {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // Split by paragraphs first (semantic boundaries)
  const paragraphs = text.split(/\n\n+/);

  let currentChunk = '';
  let currentTokens = 0;
  let startChar = 0;

  for (const paragraph of paragraphs) {
    const trimmedPara = paragraph.trim();
    if (trimmedPara.length === 0) continue;

    const paraTokens = countTokens(trimmedPara);

    // If single paragraph exceeds maxTokens, split by sentences
    if (paraTokens > config.maxTokens) {
      // Save current chunk if exists
      if (currentChunk) {
        chunks.push(createChunk(currentChunk, chunkIndex++, startChar));
        currentChunk = '';
        currentTokens = 0;
      }

      // Split paragraph by sentences
      const sentenceChunks = splitBySentences(trimmedPara, config);
      chunks.push(...sentenceChunks.map((content, i) =>
        createChunk(content, chunkIndex + i, startChar)
      ));
      chunkIndex += sentenceChunks.length;
      startChar += trimmedPara.length;
      continue;
    }

    // If adding this paragraph exceeds max, save current chunk
    if (currentTokens + paraTokens > config.maxTokens && currentChunk) {
      chunks.push(createChunk(currentChunk, chunkIndex++, startChar));

      // Start new chunk with overlap
      const overlapText = currentTokens > config.overlapTokens
        ? getLastNTokens(currentChunk, config.overlapTokens)
        : currentChunk;

      currentChunk = overlapText + '\n\n' + trimmedPara;
      startChar += currentChunk.length - trimmedPara.length;
      currentTokens = countTokens(currentChunk);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
      currentTokens += paraTokens;
    }
  }

  // Save final chunk
  if (currentChunk) {
    chunks.push(createChunk(currentChunk, chunkIndex, startChar));
  }

  return chunks;
}

/**
 * Create Chunk object with metadata
 */
function createChunk(content: string, index: number, startChar: number): Chunk {
  return {
    content: content.trim(),
    chunkIndex: index,
    tokens: countTokens(content),
    metadata: {
      startChar,
      endChar: startChar + content.length,
    },
  };
}

/**
 * Split long paragraph by sentences
 */
function splitBySentences(
  text: string,
  config: ChunkConfig
): string[] {
  // Split by sentence boundaries (. ! ?)
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = countTokens(sentence);

    if (currentTokens + sentenceTokens > config.maxTokens && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
      currentTokens = 0;
    }

    currentChunk += (currentChunk ? ' ' : '') + sentence;
    currentTokens += sentenceTokens;
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

**Test:**
```typescript
async function testChunker() {
  const { parsePDF } = await import('./pdf-parser');
  const { chunkText } = await import('./chunker');

  const doc = await parsePDF('knowledge_base/downloads/03_PERCH_study.pdf');
  const chunks = await chunkText(doc.text);

  console.log('📊 Chunk Statistics:');
  console.log('  Total chunks:', chunks.length);
  console.log('  Avg tokens:', chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length);
  console.log('  Max tokens:', Math.max(...chunks.map(c => c.tokens)));
  console.log('  Min tokens:', Math.min(...chunks.map(c => c.tokens)));
  console.log('  Avg chars:', chunks.reduce((sum, c) => sum + c.content.length, 0) / chunks.length);

  // Print first 3 chunks
  for (let i = 0; i < Math.min(3, chunks.length); i++) {
    console.log(`\n--- Chunk ${i + 1} ---`);
    console.log(`Tokens: ${chunks[i].tokens}`);
    console.log(`Preview: ${chunks[i].content.substring(0, 100)}...`);
  }
}

testChunker().catch(console.error);
```

**Expected Output:**
```
📊 Chunk Statistics:
  Total chunks: 35
  Avg tokens: 387
  Max tokens: 512
  Min tokens: 45
  Avg chars: 1,200

--- Chunk 1 ---
Tokens: 412
Preview: Background: Community-acquired pneumonia (CAP) is the leading cause of death in children worldwide...
```

---

### STEP 6: Create Embedding Client (30 phút)

**File:** `apps/api/src/lib/embedding/client.ts`

```typescript
import { logger } from '../../utils/logger';

export class EmbeddingClient {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.model = 'nomic-embed-text';
  }

  /**
   * Generate embedding for single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const startTime = Date.now();

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      const duration = Date.now() - startTime;
      logger.info('Embedding generated', {
        model: this.model,
        textLength: text.length,
        embeddingDim: data.embedding.length,
        duration: `${duration}ms`,
      });

      return data.embedding;
    } catch (error) {
      logger.error('Embedding generation failed', { error: error.message });
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts (batch processing)
   */
  async generateBatch(texts: string[]): Promise<number[][]> {
    const batchSize = 10; // Process 10 at a time
    const results: number[][] = [];

    logger.info('Batch embedding started', {
      totalTexts: texts.length,
      batchSize,
    });

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

      const embeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );

      results.push(...embeddings);

      // Rate limiting: wait 100ms between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    logger.info('Batch embedding completed', {
      totalEmbeddings: results.length,
    });

    return results;
  }

  /**
   * Test connection to Ollama
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return false;

      const data = await response.json();
      const hasModel = data.models?.some((m: any) => m.name.includes(this.model));

      if (!hasModel) {
        logger.warn(`Model ${this.model} not found. Run: ollama pull ${this.model}`);
        return false;
      }

      logger.info('✅ Embedding client connected', { model: this.model });
      return true;
    } catch (error) {
      logger.error('Embedding client connection failed', { error: error.message });
      return false;
    }
  }
}

// Singleton instance
export const embeddingClient = new EmbeddingClient();
```

**Test:**
```typescript
async function testEmbedding() {
  const { embeddingClient } = await import('./client');

  // Test connection
  const connected = await embeddingClient.testConnection();
  console.log('Connected:', connected);

  // Test single embedding
  const embedding = await embeddingClient.generateEmbedding(
    'Community-acquired pneumonia is the leading cause of death in children under 5'
  );
  console.log('Embedding dims:', embedding.length);
  console.log('First 5 values:', embedding.slice(0, 5));
}

testEmbedding().catch(console.error);
```

**Expected Output:**
```
Connected: true
Embedding dims: 768
First 5 values: [0.0234, -0.1567, 0.0891, 0.3456, -0.0123]
```

---

### STEP 7: Create Batch Embedding Processor (30 phút)

**File:** `apps/api/src/lib/embedding/batch.ts`

```typescript
import { EmbeddingClient } from './client';
import { logger } from '../../utils/logger';

interface BatchResult {
  success: boolean;
  embeddings: number[][];
  errors: { index: number; error: string }[];
  duration: number;
}

export class BatchProcessor {
  private client: EmbeddingClient;

  constructor(client?: EmbeddingClient) {
    this.client = client || new EmbeddingClient();
  }

  async processTexts(
    texts: string[],
    options?: { batchSize?: number; maxRetries?: number }
  ): Promise<BatchResult> {
    const batchSize = options?.batchSize || 10;
    const maxRetries = options?.maxRetries || 2;
    const startTime = Date.now();

    const allEmbeddings: number[][] = [];
    const errors: { index: number; error: string }[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batchStart = i;
      const batch = texts.slice(i, i + batchSize);

      logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);

      for (let retry = 0; retry <= maxRetries; retry++) {
        try {
          const embeddings = await this.client.generateBatch(batch);
          allEmbeddings.push(...embeddings);
          break; // Success, move to next batch
        } catch (error) {
          logger.warn(`Batch ${batchStart} failed (retry ${retry}/${maxRetries})`);

          if (retry === maxRetries) {
            // Record errors for all items in this batch
            for (let j = 0; j < batch.length; j++) {
              errors.push({
                index: batchStart + j,
                error: error.message,
              });
            }
          }
        }
      }

      // Rate limiting between batches
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const duration = Date.now() - startTime;
    logger.info('Batch processing completed', {
      totalTexts: texts.length,
      successCount: allEmbeddings.length,
      errorCount: errors.length,
      duration: `${duration}ms`,
    });

    return {
      success: errors.length === 0,
      embeddings: allEmbeddings,
      errors,
      duration,
    };
  }
}
```

---

### STEP 8: Create Ingestion Service (1 giờ)

**File:** `apps/api/src/lib/ingestion/service.ts`

```typescript
import { supabase } from '../../lib/supabase/client';
import { parsePDF } from './pdf-parser';
import { chunkText } from './chunker';
import { BatchProcessor } from '../embedding/batch';
import { IngestionResult, IngestionOptions, DEFAULT_INGESTION_OPTIONS } from './types';
import { logger } from '../../utils/logger';

export class IngestionService {
  private batchProcessor: BatchProcessor;

  constructor() {
    this.batchProcessor = new BatchProcessor();
  }

  async ingestDocument(
    filePath: string,
    options: IngestionOptions = DEFAULT_INGESTION_OPTIONS
  ): Promise<IngestionResult> {
    const startTime = Date.now();
    const errors: IngestionResult['errors'] = [];

    logger.info('Starting document ingestion', { filePath, options });

    try {
      // Step 1: Parse document
      let parsedDoc;
      try {
        if (filePath.endsWith('.pdf')) {
          parsedDoc = await parsePDF(filePath);
        } else {
          errors.push({ type: 'parse', message: `Unsupported file type: ${filePath}` });
          return this.buildErrorResult(errors, startTime);
        }
      } catch (parseError) {
        errors.push({ type: 'parse', message: parseError.message });
        return this.buildErrorResult(errors, startTime);
      }

      logger.info('Document parsed', {
        textLength: parsedDoc.text.length,
        pages: parsedDoc.metadata.pages,
      });

      // Step 2: Insert document metadata
      const docId = await this.insertDocument(parsedDoc, options);
      if (!docId) {
        errors.push({ type: 'insert', message: 'Failed to insert document metadata' });
        return this.buildErrorResult(errors, startTime);
      }

      logger.info('Document metadata inserted', { docId });

      // Step 3: Chunk text
      const chunks = await chunkText(parsedDoc.text);
      if (chunks.length === 0) {
        errors.push({ type: 'chunk', message: 'No chunks generated from document text' });
        return this.buildErrorResult(errors, startTime);
      }

      logger.info('Text chunked', { chunkCount: chunks.length });

      // Step 4: Generate embeddings
      const texts = chunks.map(c => c.content);
      const batchResult = await this.batchProcessor.processTexts(texts);

      if (batchResult.errors.length > 0) {
        errors.push(...batchResult.errors.map(e => ({
          type: 'embed' as const,
          message: `Chunk ${e.index}: ${e.error}`,
        })));
      }

      logger.info('Embeddings generated', {
        successCount: batchResult.embeddings.length,
        errorCount: batchResult.errors.length,
      });

      // Step 5: Insert chunks with embeddings
      let insertedChunks = 0;
      for (let i = 0; i < batchResult.embeddings.length; i++) {
        if (i < chunks.length) {
          const success = await this.insertChunk(docId, chunks[i], batchResult.embeddings[i]);
          if (success) insertedChunks++;
        }
      }

      logger.info('Chunks inserted', { insertedChunks });

      const duration = Date.now() - startTime;
      return {
        documentId: docId,
        title: parsedDoc.metadata.title,
        chunkCount: insertedChunks,
        embeddingCount: batchResult.embeddings.length,
        duration,
        errors,
      };
    } catch (error) {
      errors.push({ type: 'insert', message: error.message });
      return this.buildErrorResult(errors, startTime);
    }
  }

  private async insertDocument(
    parsedDoc: any,
    options: IngestionOptions
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          title: parsedDoc.metadata.title,
          version: options.version || '1.0',
          source: parsedDoc.metadata.source || options.source,
          effective_date: options.effectiveDate?.toISOString() || new Date().toISOString(),
          status: options.status || 'active',
          language: parsedDoc.metadata.language || options.language || 'en',
          access_level: options.accessLevel || 'clinician',
          owner: options.owner || 'system',
          file_url: null,
          checksum: null,
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to insert document', { error: error.message });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Document insert exception', { error: error.message });
      return null;
    }
  }

  private async insertChunk(
    docId: string,
    chunk: any,
    embedding: number[]
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('chunks')
        .insert({
          document_id: docId,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          embedding,
          metadata: chunk.metadata,
          effective_date: new Date().toISOString().split('T')[0],
        });

      if (error) {
        logger.error('Failed to insert chunk', {
          chunkIndex: chunk.chunkIndex,
          error: error.message,
        });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Chunk insert exception', {
        chunkIndex: chunk.chunkIndex,
        error: error.message,
      });
      return false;
    }
  }

  private buildErrorResult(
    errors: IngestionResult['errors'],
    startTime: number
  ): IngestionResult {
    return {
      documentId: '',
      title: '',
      chunkCount: 0,
      embeddingCount: 0,
      duration: Date.now() - startTime,
      errors,
    };
  }
}

// Singleton
export const ingestionService = new IngestionService();
```

---

### STEP 9: Create CLI Tool (30 phút)

**File:** `apps/api/src/scripts/ingest-documents.ts`

```typescript
#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { ingestionService } from '../lib/ingestion/service';
import { embeddingClient } from '../lib/embedding/client';
import { logger } from '../lib/utils/logger';

// CLI argument parser
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='));
const folderArg = args.find(a => a.startsWith('--folder='));
const dryRun = args.includes('--dry-run');

async function main() {
  console.log('🚀 RAG Document Ingestion CLI');
  console.log('='.repeat(50));

  // Test Ollama connection
  console.log('📡 Testing Ollama connection...');
  const ollamaOk = await embeddingClient.testConnection();
  if (!ollamaOk) {
    console.error('❌ Ollama not available. Run: ollama pull nomic-embed-text');
    process.exit(1);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No database changes will be made');
  }

  // Get files to ingest
  const files: string[] = [];

  if (fileArg) {
    const filePath = fileArg.split('=')[1];
    if (!await fileExists(filePath)) {
      console.error(`❌ File not found: ${filePath}`);
      process.exit(1);
    }
    files.push(filePath);
  } else if (folderArg) {
    const folderPath = folderArg.split('=')[1];
    if (!await dirExists(folderPath)) {
      console.error(`❌ Folder not found: ${folderPath}`);
      process.exit(1);
    }
    const entries = await fs.readdir(folderPath);
    files.push(...entries
      .filter(f => f.endsWith('.pdf'))
      .map(f => path.join(folderPath, f))
    );
  } else {
    console.log('Usage:');
    console.log('  node dist/scripts/ingest-documents.js --file=path/to/doc.pdf');
    console.log('  node dist/scripts/ingest-documents.js --folder=path/to/folder/');
    console.log('  node dist/scripts/ingest-documents.js --folder=path/ --dry-run');
    process.exit(0);
  }

  console.log(`📄 Found ${files.length} file(s) to ingest`);

  // Ingest each file
  let successCount = 0;
  let failCount = 0;

  for (const file of files) {
    console.log(`\n📥 Ingesting: ${path.basename(file)}`);

    if (dryRun) {
      console.log('  [DRY RUN] Skipping ingestion');
      successCount++;
      continue;
    }

    const result = await ingestionService.ingestDocument(file);

    if (result.documentId) {
      console.log(`  ✅ Success: ${result.chunkCount} chunks, ${result.embeddingCount} embeddings`);
      console.log(`  ⏱️  Duration: ${(result.duration / 1000).toFixed(1)}s`);
      successCount++;
    } else {
      console.log(`  ❌ Failed: ${result.errors.map(e => e.message).join(', ')}`);
      failCount++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 INGESTION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total files: ${files.length}`);
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    await fs.access(dirPath);
    return true;
  } catch {
    return false;
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

**Usage Examples:**
```bash
# Ingest single PDF
node dist/scripts/ingest-documents.js --file=knowledge_base/downloads/03_PERCH_study_deep_learning_pediatric_CXR_Chen_2021.pdf

# Ingest all PDFs in folder
node dist/scripts/ingest-documents.js --folder=knowledge_base/downloads/

# Dry run (test without database changes)
node dist/scripts/ingest-documents.js --folder=knowledge_base/downloads/ --dry-run
```

---

### STEP 10: Update Knowledge Agent (30 phút)

**File:** `apps/api/src/agents/knowledge.ts`

**Changes:**
Replace the `retrieveDocuments` method:

```typescript
// OLD (line 45-70): Remove textSearch
// NEW: Add vector similarity search
private async retrieveDocuments(
  query: string,
  maxResults: number = 5
): Promise<Array<{ document_id: string; title: string; version: string; content: string; effective_date: string; status: string }>> {
  try {
    // Generate query embedding
    const { embeddingClient } = await import('../lib/embedding/client');
    const queryEmbedding = await embeddingClient.generateEmbedding(query);

    // Call match_chunks function
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: maxResults,
      filter_sources: null,
      filter_access_levels: null,
    });

    if (error) {
      logger.error('Vector search error', { error: error.message });
      return [];
    }

    // Transform to expected format
    return (data || []).map(row => ({
      document_id: row.chunk_id,
      title: row.document_title,
      version: row.document_version,
      content: row.content,
      effective_date: new Date().toISOString(),
      status: 'active',
    }));
  } catch (err) {
    logger.error('Document retrieval exception', { error: err });
    return [];
  }
}
```

**Also update generateAnswer method** to use the new document format:

```typescript
private async generateAnswer(
  query: string,
  documents: Array<{ document_id: string; title: string; content: string }>
): Promise<string> {
  if (documents.length === 0) {
    return 'INSUFFICIENT_EVIDENCE';
  }

  // Build context from retrieved chunks
  const context = documents
    .map((doc, idx) => `[Nguồn ${idx + 1}: ${doc.title}]\n${doc.content}`)
    .join('\n\n---\n\n');

  const userPrompt = `Tài liệu tham khảo:
${context}

Câu hỏi: ${query}

Trả lời:`;

  try {
    const { ollamaClient } = await import('../lib/ollama/client.js');

    const answer = await ollamaClient.generateWithTemplate(
      this.systemPrompt,
      userPrompt,
      {
        temperature: 0.3,
        num_predict: 1024,
      }
    );

    return answer.trim();
  } catch (err) {
    logger.error('LLM generation error', { error: err });
    throw new Error('Failed to generate answer');
  }
}
```

---

## 🧪 Testing Plan

### Test 1: Unit Tests
```bash
# Run unit tests
npm test -- ingestion

# Test PDF parser
node dist/lib/ingestion/__tests__/pdf-parser.test.js

# Test chunker
node dist/lib/ingestion/__tests__/chunker.test.js

# Test embedding
node dist/lib/embedding/__tests__/client.test.js
```

### Test 2: Integration Tests
```bash
# Dry run ingestion
node dist/scripts/ingest-documents.js --file=knowledge_base/downloads/03_PERCH_study.pdf --dry-run

# Real ingestion
node dist/scripts/ingest-documents.js --file=knowledge_base/downloads/03_PERCH_study.pdf

# Verify database
# Connect to Supabase and run:
SELECT COUNT(*) FROM documents;
SELECT COUNT(*) FROM chunks;
```

### Test 3: End-to-End Tests
```bash
# Start API server
yarn dev --filter=api

# Query the RAG system
curl -X POST http://localhost:3005/api/query \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the WHO criteria for pediatric pneumonia?"}'

# Check response includes citations from ingested documents
```

---

## 📊 Success Metrics

| Metric | Target |
|--------|--------|
| PDF parsing success rate | > 95% |
| Average chunk size | 300-512 tokens |
| Embedding generation time | < 100ms per chunk |
| Total ingestion time (1 PDF) | < 30 seconds |
| Vector search latency | < 500ms |
| RAG query response time | < 3 seconds |
| Citation relevance | > 80% |

---

## ⚠️ Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ollama model not pulled | HIGH | Check in CLI, show clear error |
| Supabase connection timeout | HIGH | Retry logic, timeout handling |
| PDF extraction poor quality | MEDIUM | Log quality metrics, manual review |
| Embedding quality low | MEDIUM | Test with known queries first |
| Chunk size too small/large | LOW | Adjustable config parameters |

---

## 🔄 Rollback Plan

If something goes wrong:
```sql
-- Delete ingested documents and chunks
DELETE FROM chunks WHERE document_id IN (
  SELECT id FROM documents WHERE source = 'Internal' AND created_at > NOW() - INTERVAL '1 hour'
);

DELETE FROM documents WHERE source = 'Internal' AND created_at > NOW() - INTERVAL '1 hour';
```

---

## 📝 Implementation Checklist

- [ ] **STEP 1:** Environment Setup (Ollama + dependencies)
- [ ] **STEP 2:** Types & Interfaces
- [ ] **STEP 3:** PDF Parser
- [ ] **STEP 4:** Tokenizer Helper
- [ ] **STEP 5:** Chunker
- [ ] **STEP 6:** Embedding Client
- [ ] **STEP 7:** Batch Processor
- [ ] **STEP 8:** Ingestion Service
- [ ] **STEP 9:** CLI Tool
- [ ] **STEP 10:** Update Knowledge Agent
- [ ] **TEST 1:** Unit Tests
- [ ] **TEST 2:** Integration Tests
- [ ] **TEST 3:** End-to-End Tests

**Estimated Total Time:** 5-7 hours

---

**Status:** 📋 Plan Ready — agentBE bắt đầu implement từ STEP 1  
**Next Action:** agentBE đọc plan và bắt đầu từ Step 1 (Environment Setup)  
**Approval:** User đã approve (bắt đầu implement)
