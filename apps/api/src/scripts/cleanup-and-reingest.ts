#!/usr/bin/env node
/**
 * Cleanup & Re-ingest Script
 *
 * 1. Wipes all documents + chunks from Supabase
 * 2. Re-ingests only the 3 relevant medical PDFs with proper metadata
 */

import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { ingestionService } from '../lib/ingestion/service.js';
import { embeddingClient } from '../lib/embedding/client.js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DOWNLOADS_DIR = path.resolve('../../knowledge_base/downloads');

const PDF_FILES = [
  path.join(DOWNLOADS_DIR, '9789241549585-eng.pdf'),
  path.join(DOWNLOADS_DIR, '03_PERCH_study_deep_learning_pediatric_CXR_Chen_2021.pdf'),
  path.join(DOWNLOADS_DIR, '04_VinDr_PCXR_Dataset_Paper_Nguyen_2023.pdf'),
];

async function cleanupDatabase() {
  console.log('\n🗑️  Cleaning up database...');

  // Delete all chunks first (foreign key)
  const { error: chunksError, count: chunksDeleted } = await supabase
    .from('chunks')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // match all

  if (chunksError) {
    console.error('❌ Failed to delete chunks:', chunksError.message);
    process.exit(1);
  }
  console.log(`   ✅ Deleted chunks (all rows cleared)`);

  // Delete all documents
  const { error: docsError } = await supabase
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // match all

  if (docsError) {
    console.error('❌ Failed to delete documents:', docsError.message);
    process.exit(1);
  }
  console.log(`   ✅ Deleted documents (all rows cleared)`);
}

async function main() {
  console.log('🔧 RAG Cleanup & Re-ingest\n');

  // Verify embedding service
  console.log('🔗 Testing embedding service...');
  const ok = await embeddingClient.testConnection();
  if (!ok) {
    console.error('❌ Cannot connect to embedding service (Ollama). Aborting.');
    process.exit(1);
  }
  const dim = await embeddingClient.getEmbeddingDimension();
  console.log(`✅ Embedding OK (dim: ${dim})\n`);

  // Step 1: Clean DB
  await cleanupDatabase();

  // Step 2: Re-ingest
  console.log('\n📥 Re-ingesting 3 medical PDFs...\n');

  const results = await ingestionService.ingestBatch(PDF_FILES, {
    chunking: { max_tokens: 512, overlap_tokens: 50, preserve_sentences: true, preserve_paragraphs: true },
    batch_size: 10,
    skip_existing: false, // force re-ingest
  });

  console.log('\n📊 Results:\n');
  let totalChunks = 0;
  for (const { filePath, result } of results) {
    const name = path.basename(filePath);
    if (result.success) {
      console.log(`✅ ${name}`);
      console.log(`   Chunks: ${result.chunks_created} · Tokens: ${result.total_tokens} · ${(result.duration_ms / 1000).toFixed(1)}s`);
      totalChunks += result.chunks_created;
    } else {
      console.log(`❌ ${name}: ${result.error}`);
    }
  }

  console.log(`\n✅ Done — ${totalChunks} total chunks in Supabase`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
