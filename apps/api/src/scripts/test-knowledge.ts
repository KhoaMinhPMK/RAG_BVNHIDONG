/**
 * Test Knowledge Agent Integration
 *
 * Verify RAG pipeline works end-to-end
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testKnowledgeAgent() {
  console.log('🧪 Testing Knowledge Agent Integration...\n');

  // 1. Check if documents exist
  console.log('1️⃣ Checking documents in knowledge base...');
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, title, status')
    .limit(5);

  if (docsError) {
    console.error('❌ Failed to fetch documents:', docsError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${documents?.length || 0} documents`);
  if (documents && documents.length > 0) {
    documents.forEach((doc, i) => {
      console.log(`   ${i + 1}. ${doc.title} (${doc.status})`);
    });
  }
  console.log();

  // 2. Check if chunks exist
  console.log('2️⃣ Checking document chunks...');

  // Try 'chunks' table first (BE2 renamed it)
  let { data: chunks, error: chunksError, count } = await supabase
    .from('chunks')
    .select('id', { count: 'exact' })
    .limit(1);

  // Fallback to 'document_chunks' if 'chunks' doesn't exist
  if (chunksError) {
    const result = await supabase
      .from('document_chunks')
      .select('id', { count: 'exact' })
      .limit(1);
    chunks = result.data;
    chunksError = result.error;
    count = result.count;
  }

  if (chunksError) {
    console.error('❌ Failed to fetch chunks:', chunksError.message);
    process.exit(1);
  }

  console.log(`✅ Found ${count || 0} chunks in knowledge base\n`);

  // 3. Check if vector search function exists
  console.log('3️⃣ Testing vector search function...');

  // Create a dummy embedding (768 dimensions for nomic-embed-text)
  const dummyEmbedding = Array(768).fill(0).map(() => Math.random());

  const { data: searchResults, error: searchError } = await supabase.rpc('match_document_chunks', {
    query_embedding: dummyEmbedding,
    match_threshold: 0.5,
    match_count: 3,
  });

  if (searchError) {
    console.error('❌ Vector search function error:', searchError.message);
    console.log('⚠️  This is expected if RAG ingestion hasn\'t been run yet\n');
  } else {
    console.log(`✅ Vector search function working`);
    console.log(`   Found ${searchResults?.length || 0} matching chunks\n`);
  }

  // 4. Summary
  console.log('📊 Knowledge Agent Status:');
  console.log(`   Documents: ${documents?.length || 0}`);
  console.log(`   Chunks: ${count || 0}`);
  console.log(`   Vector search: ${searchError ? '❌ Not ready' : '✅ Ready'}`);
  console.log();

  if ((count || 0) > 0 && !searchError) {
    console.log('✅ Knowledge Agent is READY for integration!');
    console.log('🔗 Frontend can query: POST /api/query\n');
  } else {
    console.log('⚠️  Knowledge Agent needs RAG ingestion first');
    console.log('📋 Run: cd apps/api && npm run ingest:pdf <pdf-file>\n');
  }
}

testKnowledgeAgent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
