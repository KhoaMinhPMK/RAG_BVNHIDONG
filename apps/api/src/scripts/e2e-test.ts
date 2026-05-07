/**
 * E2E test script — chạy: tsx src/scripts/e2e-test.ts
 * Tests: DB counts, fulltext search, hybrid search, query rewriter, multi-query, HyDE, reranker, faithfulness
 */
import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env trước khi bất kỳ module nào đọc process.env
const _require = createRequire(import.meta.url);
const dotenv = _require('dotenv');
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { createClient } from '@supabase/supabase-js';
import { embeddingClient } from '../lib/embedding/client.js';
import { rewriteQuery, translateToEnglish } from '../lib/query/rewriter.js';
import { generateMultiQuery, rrfMerge } from '../lib/query/multi-query.js';
import { generateHypotheticalDocument } from '../lib/query/hyde.js';
import { rerankDocuments } from '../lib/reranking/cross-encoder.js';
import { checkFaithfulness } from '../lib/faithfulness/checker.js';

const TEST_QUERY = 'tăng huyết áp điều trị như thế nào';

function section(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function ok(label: string, value: unknown) {
  console.log(`  [OK] ${label}:`, typeof value === 'object' ? JSON.stringify(value).slice(0, 120) : value);
}

function fail(label: string, err: unknown) {
  console.error(`  [FAIL] ${label}:`, err);
}

async function main() {
  const SUPABASE_URL = process.env.SUPABASE_URL
    ?? 'https://mibtdruhmmcatccdzjjk.supabase.co';
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  section('1. Supabase — kiểm tra bảng chunks');
  try {
    const { count, error } = await sb.from('chunks').select('*', { count: 'exact', head: true });
    if (error) throw error;
    ok('total chunks', count);
  } catch (e) { fail('count chunks', e); }

  section('2. search_chunks_fulltext (BM25)');
  try {
    // Docs là tiếng Anh — dùng English keyword để test BM25 lexical
    const { data, error } = await sb.rpc('search_chunks_fulltext', {
      query_text: 'pneumonia treatment children hospital',
      match_count: 3,
    });
    if (error) throw error;
    ok(`rows returned (English query)`, data?.length ?? 0);
    if (data?.[0]) ok('top rank', data[0].rank?.toFixed(4));
    if (data?.[0]) ok('top chunk (snippet)', data[0].content?.slice(0, 100));
    // Note: Vietnamese queries return 0 rows from BM25 (expected — docs are English)
    ok('note', 'BM25 only matches English content. Vector search handles cross-lingual Việt-Anh.');
  } catch (e) { fail('search_chunks_fulltext', e); }

  section('3. Embedding service');
  let embedding: number[] = [];
  try {
    const result = await embeddingClient.generateEmbedding(TEST_QUERY);
    embedding = result.embedding;
    ok('embedding dims', embedding.length);
    ok('first 3 values', embedding.slice(0, 3));
  } catch (e) { fail('embed', e); }

  section('4. hybrid_search_chunks (Vector + BM25 RRF)');
  try {
    if (!embedding.length) throw new Error('no embedding — skip');
    const { data, error } = await sb.rpc('hybrid_search_chunks', {
      query_embedding: embedding,
      query_text: TEST_QUERY,
      match_threshold: 0.3,
      vector_weight: 0.6,
      bm25_weight: 0.4,
      match_count: 5,
      rrf_k: 60,
    });
    if (error) throw error;
    ok('rows returned', data?.length ?? 0);
    if (data?.[0]) {
      ok('top rrf_score', data[0].rrf_score?.toFixed(4));
      ok('top vector_score', data[0].vector_score?.toFixed(4));
      ok('top bm25_score', data[0].bm25_score?.toFixed(4));
      ok('top chunk (snippet)', data[0].content?.slice(0, 100));
    }
  } catch (e) { fail('hybrid_search_chunks', e); }

  section('5. Query Rewriter');
  let rewritten = TEST_QUERY;
  try {
    rewritten = await rewriteQuery(TEST_QUERY);
    ok('original', TEST_QUERY);
    ok('rewritten', rewritten);
  } catch (e) { fail('rewriteQuery', e); }

  section('5b. Translate to English (Cross-Lingual BM25)');
  try {
    const viQuery = 'điều trị viêm phổi ở trẻ em';
    const enQuery = await translateToEnglish(viQuery);
    ok('vietnamese input', viQuery);
    ok('english output', enQuery);
    // Verify BM25 now returns results with English translation
    if (embedding.length) {
      const enEmbedding = await embeddingClient.generateEmbedding(enQuery);
      const { data, error } = await sb.rpc('hybrid_search_chunks', {
        query_embedding: enEmbedding.embedding,
        query_text: enQuery,
        match_threshold: 0.3,
        vector_weight: 0.6,
        bm25_weight: 0.4,
        match_count: 5,
        rrf_k: 60,
      });
      if (error) throw error;
      ok('hybrid rows with English BM25', data?.length ?? 0);
      if (data?.[0]) ok('top bm25_score', data[0].bm25_score?.toFixed(4));
    }
  } catch (e) { fail('translateToEnglish', e); }

  section('6. Multi-Query Generator');
  let variants: string[] = [];
  try {
    variants = await generateMultiQuery(TEST_QUERY, 3);
    ok('variants count', variants.length);
    variants.forEach((v, i) => ok(`variant ${i + 1}`, v));
  } catch (e) { fail('generateMultiQuery', e); }

  section('7. HyDE — Hypothetical Document');
  try {
    const hypo = await generateHypotheticalDocument(TEST_QUERY);
    ok('hypo doc (snippet)', (hypo ?? '').slice(0, 150));
  } catch (e) { fail('generateHypotheticalDocument', e); }

  section('8. RRF Merge');
  try {
    const list1 = [
      { document_id: 'a', content: 'chunk A' },
      { document_id: 'b', content: 'chunk B' },
    ];
    const list2 = [
      { document_id: 'b', content: 'chunk B' },
      { document_id: 'c', content: 'chunk C' },
    ];
    const merged = rrfMerge([list1, list2], 60);
    ok('merged count', merged.length);
    ok('merged order (doc_ids)', merged.map((m) => m.document_id).join(', '));
  } catch (e) { fail('rrfMerge', e); }

  section('9. Cross-Encoder Reranker');
  try {
    // Dùng kết quả từ hybrid search (vector-only vì query Việt, docs Anh)
    if (!embedding.length) throw new Error('no embedding from step 3 — skip');
    const { data: hybridChunks, error: hybridErr } = await sb.rpc('hybrid_search_chunks', {
      query_embedding: embedding,
      query_text: TEST_QUERY,
      match_threshold: 0.3,
      vector_weight: 0.6,
      bm25_weight: 0.4,
      match_count: 5,
      rrf_k: 60,
    });
    if (hybridErr) throw hybridErr;
    if (!hybridChunks?.length) throw new Error('no hybrid chunks to rerank');
    const candidates = hybridChunks.map((c: { document_id: string; content: string; metadata: unknown }) => ({
      document_id: c.document_id,
      content: c.content,
      metadata: c.metadata,
    }));
    const reranked = await rerankDocuments(TEST_QUERY, candidates, 3);
    ok('input candidates', candidates.length);
    ok('reranked count', reranked.length);
    ok('top doc snippet', reranked[0]?.content?.slice(0, 100));
  } catch (e) { fail('rerankDocuments', e); }

  section('10. Faithfulness Checker');
  try {
    const sampleAnswer = 'Tăng huyết áp điều trị bằng thuốc ức chế men chuyển và thay đổi lối sống.';
    const sampleContext = 'Hướng dẫn điều trị tăng huyết áp: sử dụng thuốc ức chế men chuyển ACE inhibitor, thuốc chẹn beta, và can thiệp lối sống như giảm muối, tập thể dục.';
    const result = await checkFaithfulness(TEST_QUERY, sampleAnswer, sampleContext);
    ok('verdict', result.verdict);
    ok('score', result.score);
    ok('reasoning (snippet)', result.reasoning?.slice(0, 100));
  } catch (e) { fail('checkFaithfulness', e); }

  console.log('\n' + '='.repeat(60));
  console.log('  E2E TEST COMPLETE');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
