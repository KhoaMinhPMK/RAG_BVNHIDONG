/**
 * RAG Offline Evaluation Script
 *
 * Runs a QA test suite against the KnowledgeAgent and reports:
 *   - Recall@k  : fraction of relevant docs found in top-k
 *   - MRR       : mean reciprocal rank of first relevant doc
 *   - Faithfulness score distribution
 *   - Answer latency p50/p95
 *
 * Usage:
 *   tsx src/scripts/eval-rag.ts [--json] [--k 5]
 *
 * Add test cases to the QA_PAIRS array below, or point to an external JSON
 * file via RAG_EVAL_DATASET env var.
 */

import { knowledgeAgent } from '../agents/knowledge.js';
import { checkFaithfulness } from '../lib/faithfulness/checker.js';
import { logger } from '../lib/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ──────────────────────────────────────────────────────────────────────────────
// Built-in QA test cases (add/edit as needed)
// Format: { query, relevant_doc_keywords: keywords that should appear in top citations }
// ──────────────────────────────────────────────────────────────────────────────
const BUILT_IN_QA_PAIRS: Array<{
  query: string;
  relevant_keywords: string[];
  expected_status?: 'success' | 'insufficient_evidence' | 'out_of_scope';
}> = [
  {
    query: 'Chẩn đoán viêm phổi trẻ em theo tiêu chuẩn WHO',
    relevant_keywords: ['WHO', 'pneumonia', 'viêm phổi', 'chẩn đoán'],
  },
  {
    query: 'Kháng sinh điều trị viêm phổi nhi khoa',
    relevant_keywords: ['antibiotic', 'kháng sinh', 'amoxicillin', 'penicillin'],
  },
  {
    query: 'X-quang ngực đọc viêm phổi',
    relevant_keywords: ['X-quang', 'xray', 'chest', 'radiograph', 'PCXR'],
  },
  {
    query: 'Tiêu chuẩn nhập viện viêm phổi nặng',
    relevant_keywords: ['nhập viện', 'severe', 'nặng', 'admission'],
  },
  {
    query: 'Câu hỏi không liên quan đến y tế: thời tiết hôm nay',
    relevant_keywords: [],
    expected_status: 'out_of_scope',
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Evaluation logic
// ──────────────────────────────────────────────────────────────────────────────

interface EvalResult {
  query: string;
  status: string;
  recall_at_k: number;
  reciprocal_rank: number;
  faithfulness_score: number;
  faithfulness_verdict: string;
  latency_ms: number;
  citations: string[];
}

async function evalOne(
  queryCase: (typeof BUILT_IN_QA_PAIRS)[0],
  k: number
): Promise<EvalResult> {
  const t0 = Date.now();

  const response = await knowledgeAgent.query({
    query: queryCase.query,
    role: 'clinician',
    max_results: k,
    provider: 'ollama',
  });

  const latency_ms = Date.now() - t0;

  // Recall@k: fraction of relevant keywords found in top-k citations
  const citedTitles = response.citations.map((c) => c.document_title.toLowerCase());
  const citedContent = response.citations.map((c) => c.excerpt.toLowerCase()).join(' ');
  const haystack = citedTitles.join(' ') + ' ' + citedContent;

  let recall_at_k = 0;
  if (queryCase.relevant_keywords.length > 0) {
    const matched = queryCase.relevant_keywords.filter((kw) =>
      haystack.includes(kw.toLowerCase())
    );
    recall_at_k = matched.length / queryCase.relevant_keywords.length;
  } else {
    // No relevant docs expected → recall = 1.0 if status is as expected
    recall_at_k =
      response.status === (queryCase.expected_status ?? 'success') ? 1.0 : 0.0;
  }

  // MRR: rank of first citation that contains any relevant keyword
  let first_relevant_rank = k + 1;
  for (let i = 0; i < response.citations.length; i++) {
    const t = (response.citations[i].document_title + ' ' + response.citations[i].excerpt).toLowerCase();
    if (queryCase.relevant_keywords.some((kw) => t.includes(kw.toLowerCase()))) {
      first_relevant_rank = i + 1;
      break;
    }
  }
  const reciprocal_rank = 1 / first_relevant_rank;

  // Faithfulness check
  const contextForCheck = response.citations
    .map((c, i) => `[${i + 1}: ${c.document_title}]\n${c.excerpt}`)
    .join('\n\n');

  const faith = await checkFaithfulness(queryCase.query, response.answer, contextForCheck);

  return {
    query: queryCase.query,
    status: response.status,
    recall_at_k,
    reciprocal_rank,
    faithfulness_score: faith.score,
    faithfulness_verdict: faith.verdict,
    latency_ms,
    citations: response.citations.map((c) => c.document_title),
  };
}

async function runEval(k: number = 5, outputJson: boolean = false): Promise<void> {
  // Load external dataset if provided
  let pairs = BUILT_IN_QA_PAIRS;

  const externalPath = process.env.RAG_EVAL_DATASET;
  if (externalPath) {
    try {
      const raw = await fs.readFile(externalPath, 'utf-8');
      pairs = JSON.parse(raw);
      console.log(`Loaded ${pairs.length} test cases from ${externalPath}`);
    } catch (err) {
      console.error('Failed to load external dataset, using built-in pairs', err);
    }
  }

  console.log(`\nRAG Evaluation — k=${k}, n=${pairs.length} queries\n${'─'.repeat(60)}`);

  const results: EvalResult[] = [];

  for (let i = 0; i < pairs.length; i++) {
    const qc = pairs[i];
    process.stdout.write(`[${i + 1}/${pairs.length}] ${qc.query.slice(0, 50)}… `);

    try {
      const result = await evalOne(qc, k);
      results.push(result);
      process.stdout.write(
        `recall=${result.recall_at_k.toFixed(2)} mrr=${result.reciprocal_rank.toFixed(2)} ` +
          `faith=${result.faithfulness_verdict}(${result.faithfulness_score.toFixed(2)}) ` +
          `${result.latency_ms}ms\n`
      );
    } catch (err) {
      process.stdout.write(`ERROR: ${err}\n`);
    }
  }

  if (results.length === 0) {
    console.log('No results to aggregate.');
    return;
  }

  // Aggregate metrics
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);

  const latencies = results.map((r) => r.latency_ms);
  const sortedLat = sorted(latencies);

  const summary = {
    n: results.length,
    recall_at_k: avg(results.map((r) => r.recall_at_k)),
    mrr: avg(results.map((r) => r.reciprocal_rank)),
    faithfulness_avg: avg(results.map((r) => r.faithfulness_score)),
    faithfulness_distribution: {
      SUPPORTED: results.filter((r) => r.faithfulness_verdict === 'SUPPORTED').length,
      PARTIAL: results.filter((r) => r.faithfulness_verdict === 'PARTIAL').length,
      UNSUPPORTED: results.filter((r) => r.faithfulness_verdict === 'UNSUPPORTED').length,
    },
    latency_p50_ms: sortedLat[Math.floor(sortedLat.length * 0.5)],
    latency_p95_ms: sortedLat[Math.floor(sortedLat.length * 0.95)],
  };

  console.log('\n' + '─'.repeat(60));
  console.log('SUMMARY');
  console.log('─'.repeat(60));
  console.log(`Recall@${k}  : ${summary.recall_at_k.toFixed(3)}`);
  console.log(`MRR        : ${summary.mrr.toFixed(3)}`);
  console.log(`Faithfulness (avg): ${summary.faithfulness_avg.toFixed(3)}`);
  console.log(
    `Faithfulness dist: SUPPORTED=${summary.faithfulness_distribution.SUPPORTED} ` +
      `PARTIAL=${summary.faithfulness_distribution.PARTIAL} ` +
      `UNSUPPORTED=${summary.faithfulness_distribution.UNSUPPORTED}`
  );
  console.log(`Latency p50: ${summary.latency_p50_ms}ms`);
  console.log(`Latency p95: ${summary.latency_p95_ms}ms`);

  if (outputJson) {
    const outPath = path.join(__dirname, '../../eval-results.json');
    await fs.writeFile(outPath, JSON.stringify({ summary, results }, null, 2));
    console.log(`\nFull results written to ${outPath}`);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CLI entry point
// ──────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const k = parseInt(args.find((a) => a.startsWith('--k='))?.split('=')[1] ?? '5', 10);
const outputJson = args.includes('--json');

runEval(k, outputJson).catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
