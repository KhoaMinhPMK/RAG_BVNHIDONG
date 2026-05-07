#!/usr/bin/env tsx
/**
 * Check RAG Database Status
 * Verifies documents, chunks, embeddings, and RPC functions
 */

import dotenv from 'dotenv';
dotenv.config();

import { supabase } from '../lib/supabase/client.js';

async function checkRAGStatus() {
  console.log('🔍 Checking RAG Database Status...\n');
  console.log('═'.repeat(80));

  try {
    // 1. Check documents
    console.log('\n📄 DOCUMENTS TABLE:');
    const { data: docs, error: docsError } = await supabase
      .from('documents')
      .select('id, title, created_at');

    if (docsError) {
      console.log(`❌ Error: ${docsError.message}`);
    } else {
      console.log(`✅ Total documents: ${docs?.length || 0}`);
      if (docs && docs.length > 0) {
        docs.forEach((doc, i) => {
          console.log(`   ${i + 1}. ${doc.title} (${doc.id.slice(0, 8)}...)`);
        });
      }
    }

    // 2. Check chunks
    console.log('\n📦 CHUNKS TABLE:');
    const { count: chunkCount, error: chunkCountError } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true });

    if (chunkCountError) {
      console.log(`❌ Error: ${chunkCountError.message}`);
    } else {
      console.log(`✅ Total chunks: ${chunkCount || 0}`);
    }

    // 3. Check embeddings
    console.log('\n🧮 EMBEDDINGS:');
    const { data: embeddingCheck, error: embError } = await supabase
      .from('chunks')
      .select('embedding')
      .not('embedding', 'is', null)
      .limit(1);

    if (embError) {
      console.log(`❌ Error: ${embError.message}`);
    } else if (embeddingCheck && embeddingCheck.length > 0) {
      const embedding = embeddingCheck[0].embedding;
      console.log(`✅ Embeddings exist`);
      console.log(`   Dimension: ${Array.isArray(embedding) ? embedding.length : 'unknown'}`);
      console.log(`   Sample: [${Array.isArray(embedding) ? embedding.slice(0, 3).join(', ') : 'N/A'}...]`);
    } else {
      console.log(`❌ No embeddings found`);
    }

    // 4. Check chunks with embeddings count
    const { count: embCount, error: embCountError } = await supabase
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);

    if (!embCountError) {
      console.log(`   Chunks with embeddings: ${embCount || 0}/${chunkCount || 0}`);
    }

    // 5. Test RPC function
    console.log('\n🔧 RPC FUNCTION TEST:');

    // Get a sample embedding first
    const { data: sampleChunk, error: sampleError } = await supabase
      .from('chunks')
      .select('embedding')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (sampleError || !sampleChunk) {
      console.log(`❌ Cannot get sample embedding: ${sampleError?.message || 'No data'}`);
    } else {
      console.log(`✅ Sample embedding retrieved`);

      // Test RPC function
      const { data: rpcResult, error: rpcError } = await supabase.rpc('match_document_chunks', {
        query_embedding: sampleChunk.embedding,
        match_threshold: 0.5,
        match_count: 3,
      });

      if (rpcError) {
        console.log(`❌ RPC function error: ${rpcError.message}`);
        console.log(`   Code: ${rpcError.code}`);
        console.log(`   Details: ${rpcError.details}`);
      } else {
        console.log(`✅ RPC function works`);
        console.log(`   Results returned: ${rpcResult?.length || 0}`);
        if (rpcResult && rpcResult.length > 0) {
          console.log(`   Top result: ${rpcResult[0].document_title || 'N/A'}`);
          console.log(`   Similarity: ${rpcResult[0].similarity || 'N/A'}`);
        }
      }
    }

    // 6. Check index
    console.log('\n📊 INDEXES:');
    let indexes: Array<unknown> | null = null;
    let idxError: { message: string } | null = null;

    try {
      const result = await supabase.rpc('pg_indexes', {
        schemaname: 'public',
        tablename: 'chunks',
      });
      indexes = (result.data as Array<unknown> | null) ?? null;
      idxError = result.error ? { message: result.error.message } : null;
    } catch {
      idxError = { message: 'pg_indexes not available' };
    }

    if (idxError || !indexes) {
      console.log(`⚠️  Cannot check indexes (requires admin access)`);
    } else {
      console.log(`✅ Indexes found: ${indexes?.length || 0}`);
    }

    console.log('\n' + '═'.repeat(80));
    console.log('\n✅ Status check complete!\n');

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
  }
}

checkRAGStatus();
