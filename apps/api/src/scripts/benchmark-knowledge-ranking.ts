#!/usr/bin/env tsx

import { rankKnowledgeDocuments, type KnowledgeDocument } from '../agents/knowledge-ranking.js';

type BenchmarkCase = {
  query: string;
  expectedTopId: string;
  matches: KnowledgeDocument[];
};

function createMatch(overrides: Partial<KnowledgeDocument>): KnowledgeDocument {
  return {
    document_id: 'doc',
    title: 'Untitled',
    version: 'v1.0',
    content: 'content',
    effective_date: '2026-01-01',
    status: 'active',
    similarity: 0,
    lexical_score: 0,
    matched_terms: [],
    ...overrides,
  };
}

function denseOnlyScore(match: KnowledgeDocument) {
  return match.similarity ?? 0;
}

function denseOnlyTopId(testCase: BenchmarkCase) {
  return [...testCase.matches].sort((left, right) => denseOnlyScore(right) - denseOnlyScore(left))[0]?.document_id;
}

function reciprocalRank(results: KnowledgeDocument[], expectedTopId: string) {
  const index = results.findIndex((result) => result.document_id === expectedTopId);
  return index === -1 ? 0 : 1 / (index + 1);
}

const benchmarkCases: BenchmarkCase[] = [
  {
    query: 'Guideline antibiotic treatment for pediatric pneumonia',
    expectedTopId: 'who-guideline',
    matches: [
      createMatch({
        document_id: 'generic-research',
        title: 'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation',
        content: 'deep learning dataset benchmark',
        similarity: 0.71,
        lexical_score: 0.1,
        matched_terms: ['pediatric'],
      }),
      createMatch({
        document_id: 'who-guideline',
        title: 'WHO Pocket Book: Hospital Care for Children',
        content: 'antibiotic treatment guideline for pneumonia in children',
        similarity: 0.55,
        lexical_score: 0.8,
        matched_terms: ['guideline', 'antibiotic', 'treatment', 'pneumonia'],
      }),
    ],
  },
  {
    query: 'Deep learning dataset for pediatric chest x-ray research',
    expectedTopId: 'perch-study',
    matches: [
      createMatch({
        document_id: 'perch-study',
        title: 'PERCH Study: Deep Learning for Pediatric Chest X-ray Interpretation',
        content: 'research dataset benchmark for pediatric chest x-ray',
        similarity: 0.62,
        lexical_score: 0.78,
        matched_terms: ['deep', 'learning', 'dataset', 'research'],
      }),
      createMatch({
        document_id: 'who-guideline',
        title: 'WHO Pocket Book: Hospital Care for Children',
        content: 'clinical guideline for inpatient treatment',
        similarity: 0.68,
        lexical_score: 0.12,
        matched_terms: ['pediatric'],
      }),
    ],
  },
  {
    query: 'Hospital care recommendation for children with pneumonia',
    expectedTopId: 'who-guideline',
    matches: [
      createMatch({
        document_id: 'vindr-paper',
        title: 'VinDr-PCXR Dataset Paper',
        content: 'dataset description for pediatric chest x-ray',
        similarity: 0.66,
        lexical_score: 0.18,
        matched_terms: ['children'],
      }),
      createMatch({
        document_id: 'who-guideline',
        title: 'WHO Pocket Book: Hospital Care for Children',
        content: 'hospital care recommendation for children with pneumonia',
        similarity: 0.59,
        lexical_score: 0.9,
        matched_terms: ['hospital', 'care', 'recommendation', 'children', 'pneumonia'],
      }),
    ],
  },
];

function main() {
  let denseHits = 0;
  let rerankedHits = 0;
  let denseMrr = 0;
  let rerankedMrr = 0;

  console.log('📊 Benchmarking hybrid retrieval reranking\n');

  for (const testCase of benchmarkCases) {
    const denseTop = denseOnlyTopId(testCase);
    const reranked = rankKnowledgeDocuments(testCase.query, testCase.matches, testCase.matches.length);
    const rerankedTop = reranked[0]?.document_id;

    if (denseTop === testCase.expectedTopId) {
      denseHits += 1;
    }

    if (rerankedTop === testCase.expectedTopId) {
      rerankedHits += 1;
    }

    denseMrr += reciprocalRank(
      [...testCase.matches].sort((left, right) => (right.similarity ?? 0) - (left.similarity ?? 0)),
      testCase.expectedTopId
    );
    rerankedMrr += reciprocalRank(reranked, testCase.expectedTopId);

    console.log(`Query: ${testCase.query}`);
    console.log(`   Dense-only top: ${denseTop}`);
    console.log(`   Reranked top:   ${rerankedTop}`);
    console.log(`   Expected top:   ${testCase.expectedTopId}`);
  }

  console.log('\n📈 Summary');
  console.log(`   Dense-only top1: ${denseHits}/${benchmarkCases.length}`);
  console.log(`   Reranked top1:   ${rerankedHits}/${benchmarkCases.length}`);
  console.log(`   Dense-only MRR:  ${(denseMrr / benchmarkCases.length).toFixed(3)}`);
  console.log(`   Reranked MRR:    ${(rerankedMrr / benchmarkCases.length).toFixed(3)}`);
}

main();