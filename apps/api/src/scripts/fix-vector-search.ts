#!/usr/bin/env tsx
/**
 * Fix Vector Search RPC Function
 * Runs SQL to fix table name mismatch
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase/client.js';
import { readFileSync } from 'fs';

async function fixVectorSearchFunction() {
  console.log('🔧 Fixing Vector Search RPC Function...\n');

  try {
    // Read SQL file
    const sql = readFileSync('/mnt/e/project/webrag/apps/api/fix-vector-search-function.sql', 'utf-8');

    console.log('📄 SQL to execute:');
    console.log('─'.repeat(80));
    console.log(sql);
    console.log('─'.repeat(80));
    console.log();

    // Execute SQL
    console.log('⏳ Executing SQL...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Error executing SQL:', error.message);
      console.error('   Code:', error.code);
      console.error('   Details:', error.details);
      console.log('\n⚠️  Note: exec_sql RPC might not exist. Use Supabase SQL Editor instead.');
      console.log('\n📋 MANUAL STEPS:');
      console.log('1. Go to Supabase Dashboard → SQL Editor');
      console.log('2. Copy the SQL from: fix-vector-search-function.sql');
      console.log('3. Run the SQL');
      console.log('4. Re-run test-knowledge-agent.ts');
      process.exit(1);
    }

    console.log('✅ SQL executed successfully!');
    console.log();

    // Test the fixed function
    console.log('🧪 Testing fixed RPC function...');

    const { data: sampleChunk, error: sampleError } = await supabase
      .from('chunks')
      .select('embedding')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (sampleError || !sampleChunk) {
      console.error('❌ Cannot get sample embedding');
      process.exit(1);
    }

    const { data: rpcResult, error: rpcError } = await supabase.rpc('match_document_chunks', {
      query_embedding: sampleChunk.embedding,
      match_threshold: 0.5,
      match_count: 3,
    });

    if (rpcError) {
      console.error('❌ RPC still has error:', rpcError.message);
      process.exit(1);
    }

    console.log('✅ RPC function works!');
    console.log(`   Results: ${rpcResult?.length || 0}`);
    if (rpcResult && rpcResult.length > 0) {
      console.log(`   Top result: ${rpcResult[0].document_title}`);
      console.log(`   Similarity: ${rpcResult[0].similarity}`);
    }

    console.log('\n✅ Fix complete! Ready to test Knowledge Agent.\n');

  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

fixVectorSearchFunction();
