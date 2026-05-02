/**
 * Test Vector Search RPC Function
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

async function testVectorSearch() {
  console.log('🧪 Testing Vector Search RPC Function...\n');

  // 1. Check chunks table structure
  console.log('1️⃣ Checking chunks table structure...');
  const { data: sample, error: sampleError } = await supabase
    .from('chunks')
    .select('*')
    .limit(1);

  if (sampleError) {
    console.log(`   ❌ Error: ${sampleError.message}\n`);
    return;
  }

  if (sample && sample[0]) {
    console.log('   ✅ Columns:', Object.keys(sample[0]).join(', '));
    console.log('   ✅ Has embedding:', 'embedding' in sample[0] ? 'Yes' : 'No');
    console.log();
  }

  // 2. Test RPC function
  console.log('2️⃣ Testing match_document_chunks RPC...');
  const dummyEmbedding = Array(768).fill(0).map(() => Math.random());

  const { data: rpcResult, error: rpcError } = await supabase.rpc('match_document_chunks', {
    query_embedding: dummyEmbedding,
    match_threshold: 0.5,
    match_count: 3,
  });

  if (rpcError) {
    console.log(`   ❌ RPC Error: ${rpcError.message}`);
    console.log(`   Code: ${rpcError.code}`);
    console.log(`   Details: ${rpcError.details || 'N/A'}`);
    console.log();
    console.log('💡 Possible issues:');
    console.log('   - RPC function references wrong table (document_chunks vs chunks)');
    console.log('   - RPC function not created yet');
    console.log('   - Embedding column missing or wrong type');
    console.log();
  } else {
    console.log(`   ✅ RPC Success: ${rpcResult?.length || 0} results`);
    if (rpcResult && rpcResult.length > 0) {
      console.log(`   Sample result:`, {
        document_id: rpcResult[0].document_id,
        similarity: rpcResult[0].similarity,
        content_preview: rpcResult[0].content?.substring(0, 50) + '...',
      });
    }
    console.log();
  }

  // 3. Direct query test
  console.log('3️⃣ Testing direct query...');
  const { data: directQuery, error: directError } = await supabase
    .from('chunks')
    .select('id, document_id, content')
    .limit(3);

  if (directError) {
    console.log(`   ❌ Error: ${directError.message}\n`);
  } else {
    console.log(`   ✅ Direct query works: ${directQuery?.length || 0} results\n`);
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   Chunks table: ${sampleError ? '❌' : '✅'}`);
  console.log(`   RPC function: ${rpcError ? '❌' : '✅'}`);
  console.log(`   Direct query: ${directError ? '❌' : '✅'}`);
  console.log();

  if (rpcError) {
    console.log('⚠️  Vector search not working - RPC function needs fix');
    console.log('📋 Action: Ask @BE2 to update match_document_chunks to query "chunks" table\n');
  } else {
    console.log('✅ Vector search operational!\n');
  }
}

testVectorSearch()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
