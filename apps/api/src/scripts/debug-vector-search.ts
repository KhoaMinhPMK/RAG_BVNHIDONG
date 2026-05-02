#!/usr/bin/env tsx
/**
 * Debug Vector Search
 * Test RPC function directly with sample embedding
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase/client.js';
import { embeddingClient } from '../lib/embedding/client.js';

async function debugVectorSearch() {
  console.log('🔍 Debugging Vector Search...\n');

  try {
    // 1. Get a sample embedding from database
    console.log('📦 Step 1: Get sample embedding from database');
    const { data: sampleChunk, error: sampleError } = await supabase
      .from('chunks')
      .select('id, content, embedding, document_id')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (sampleError || !sampleChunk) {
      console.error('❌ Cannot get sample chunk:', sampleError?.message);
      process.exit(1);
    }

    console.log('✅ Sample chunk retrieved');
    console.log(`   ID: ${sampleChunk.id}`);
    console.log(`   Content: ${sampleChunk.content.slice(0, 100)}...`);
    console.log(`   Embedding type: ${typeof sampleChunk.embedding}`);
    console.log(`   Embedding is array: ${Array.isArray(sampleChunk.embedding)}`);

    // 2. Test RPC with the SAME embedding (should return similarity = 1.0)
    console.log('\n🧪 Step 2: Test RPC with same embedding (threshold = 0)');
    const { data: selfMatch, error: selfError } = await supabase.rpc('match_document_chunks', {
      query_embedding: sampleChunk.embedding,
      match_threshold: 0.0,
      match_count: 5,
    });

    if (selfError) {
      console.error('❌ RPC error:', selfError.message);
      console.error('   Code:', selfError.code);
      console.error('   Details:', selfError.details);
      process.exit(1);
    }

    console.log('✅ RPC executed successfully');
    console.log(`   Results: ${selfMatch?.length || 0}`);

    if (selfMatch && selfMatch.length > 0) {
      console.log('\n📊 Top 3 results:');
      selfMatch.slice(0, 3).forEach((r: any, i: number) => {
        console.log(`   ${i + 1}. ${r.document_title}`);
        console.log(`      Similarity: ${r.similarity}`);
        console.log(`      Content: ${r.content.slice(0, 80)}...`);
      });
    } else {
      console.log('⚠️  No results returned even with threshold = 0!');
      console.log('   This indicates RPC function is not working correctly.');
    }

    // 3. Generate new embedding and test
    console.log('\n🧪 Step 3: Generate new embedding for query');
    const testQuery = 'pediatric pneumonia symptoms';
    console.log(`   Query: "${testQuery}"`);

    const queryEmbedding = await embeddingClient.generateEmbedding(testQuery);
    console.log('✅ Query embedding generated');
    console.log(`   Dimension: ${queryEmbedding.embedding.length}`);

    // 4. Test RPC with new embedding
    console.log('\n🧪 Step 4: Test RPC with query embedding (threshold = 0.5)');
    const { data: queryMatch, error: queryError } = await supabase.rpc('match_document_chunks', {
      query_embedding: queryEmbedding.embedding,
      match_threshold: 0.5,
      match_count: 5,
    });

    if (queryError) {
      console.error('❌ RPC error:', queryError.message);
      process.exit(1);
    }

    console.log('✅ RPC executed successfully');
    console.log(`   Results: ${queryMatch?.length || 0}`);

    if (queryMatch && queryMatch.length > 0) {
      console.log('\n📊 Top 3 results:');
      queryMatch.slice(0, 3).forEach((r: any, i: number) => {
        console.log(`   ${i + 1}. ${r.document_title}`);
        console.log(`      Similarity: ${r.similarity.toFixed(3)}`);
        console.log(`      Content: ${r.content.slice(0, 80)}...`);
      });
    } else {
      console.log('⚠️  No results with threshold = 0.5');

      // Try with threshold = 0
      console.log('\n🧪 Step 5: Retry with threshold = 0');
      const { data: zeroMatch, error: zeroError } = await supabase.rpc('match_document_chunks', {
        query_embedding: queryEmbedding.embedding,
        match_threshold: 0.0,
        match_count: 5,
      });

      if (zeroError) {
        console.error('❌ RPC error:', zeroError.message);
      } else {
        console.log(`   Results: ${zeroMatch?.length || 0}`);
        if (zeroMatch && zeroMatch.length > 0) {
          console.log('\n📊 Results with threshold = 0:');
          zeroMatch.slice(0, 3).forEach((r: any, i: number) => {
            console.log(`   ${i + 1}. Similarity: ${r.similarity.toFixed(3)} - ${r.document_title}`);
          });
        }
      }
    }

    console.log('\n✅ Debug complete!\n');

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugVectorSearch();
