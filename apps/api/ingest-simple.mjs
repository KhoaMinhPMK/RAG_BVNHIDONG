#!/usr/bin/env node
/**
 * Simple ingestion script without tsx dependency
 * Usage: node ingest-simple.mjs <pdf-path>
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Configuration
// ============================================================================

const OLLAMA_URL = process.env.OLLAMA_URL;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLLAMA_URL || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================================
// Helper Functions
// ============================================================================

async function generateEmbedding(text) {
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  });

  const data = await response.json();
  return data.embedding;
}

function simpleChunk(text, maxLength = 1000) {
  const chunks = [];
  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + para).length > maxLength && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 50);
}

// ============================================================================
// Main Ingestion
// ============================================================================

async function ingestPDF(pdfPath) {
  console.log('📄 Reading PDF:', pdfPath);

  // Read PDF
  const dataBuffer = await fs.readFile(pdfPath);
  const parser = new PDFParse();
  const pdfData = await parser.parse(dataBuffer);
  const text = pdfData.text;

  console.log('📝 Extracted text:', text.length, 'characters');

  // Create document record
  const filename = path.basename(pdfPath);
  const documentId = crypto.randomUUID();

  const { error: docError } = await supabase
    .from('documents')
    .insert({
      id: documentId,
      title: filename.replace('.pdf', ''),
      source: 'Internal',
      type: 'guideline',
      version: 'v1.0',
      effective_date: new Date().toISOString().split('T')[0],
      status: 'active',
      content: text.substring(0, 5000), // Store first 5000 chars
      metadata: { filename, pages: pdfData.numpages }
    });

  if (docError) {
    console.error('❌ Document insert error:', docError.message);
    return;
  }

  console.log('✅ Document created:', documentId);

  // Chunk text
  const chunks = simpleChunk(text);
  console.log('📦 Created', chunks.length, 'chunks');

  // Generate embeddings and insert
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`🔄 Processing chunk ${i + 1}/${chunks.length}...`);

    try {
      const embedding = await generateEmbedding(chunk);

      const { error: chunkError } = await supabase
        .from('document_chunks')
        .insert({
          id: crypto.randomUUID(),
          document_id: documentId,
          content: chunk,
          embedding: embedding,
          chunk_index: i,
          token_count: Math.floor(chunk.length / 4),
          metadata: {}
        });

      if (chunkError) {
        console.error('❌ Chunk insert error:', chunkError.message);
      } else {
        console.log(`✅ Chunk ${i + 1} inserted`);
      }
    } catch (err) {
      console.error('❌ Error processing chunk:', err.message);
    }
  }

  console.log('🎉 Ingestion complete!');
}

// ============================================================================
// CLI
// ============================================================================

const pdfPath = process.argv[2];

if (!pdfPath) {
  console.error('Usage: node ingest-simple.mjs <pdf-path>');
  process.exit(1);
}

ingestPDF(pdfPath).catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
