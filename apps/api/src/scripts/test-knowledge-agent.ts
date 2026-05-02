#!/usr/bin/env tsx
/**
 * Knowledge Agent Testing Script
 * Tests RAG pipeline with real medical queries
 */

import dotenv from 'dotenv';
dotenv.config();

import { knowledgeAgent } from '../agents/knowledge.js';
import { logger } from '../lib/utils/logger.js';

interface TestQuery {
  query: string;
  expectedRelevance: 'high' | 'medium' | 'low';
  category: string;
}

const testQueries: TestQuery[] = [
  // High relevance - should find exact matches
  {
    query: 'What are the symptoms of pediatric pneumonia?',
    expectedRelevance: 'high',
    category: 'symptoms',
  },
  {
    query: 'How to diagnose pneumonia in children?',
    expectedRelevance: 'high',
    category: 'diagnosis',
  },
  {
    query: 'Treatment guidelines for pediatric pneumonia',
    expectedRelevance: 'high',
    category: 'treatment',
  },
  {
    query: 'Chest X-ray findings in pediatric pneumonia',
    expectedRelevance: 'high',
    category: 'imaging',
  },
  {
    query: 'Antibiotic therapy for children with pneumonia',
    expectedRelevance: 'high',
    category: 'treatment',
  },

  // Medium relevance - related topics
  {
    query: 'Risk factors for pneumonia in children',
    expectedRelevance: 'medium',
    category: 'epidemiology',
  },
  {
    query: 'Complications of pediatric pneumonia',
    expectedRelevance: 'medium',
    category: 'complications',
  },
  {
    query: 'Prevention of pneumonia in children',
    expectedRelevance: 'medium',
    category: 'prevention',
  },

  // Low relevance - edge cases
  {
    query: 'Deep learning models for chest X-ray analysis',
    expectedRelevance: 'low',
    category: 'ai_ml',
  },
  {
    query: 'VinDr-PCXR dataset characteristics',
    expectedRelevance: 'low',
    category: 'dataset',
  },

  // Out of scope
  {
    query: 'How to treat adult heart disease?',
    expectedRelevance: 'low',
    category: 'out_of_scope',
  },
  {
    query: 'What is the weather today?',
    expectedRelevance: 'low',
    category: 'out_of_scope',
  },
];

interface TestResult {
  query: string;
  category: string;
  expectedRelevance: string;
  status: string;
  citationCount: number;
  latency: number;
  answer: string;
  topCitation?: string;
  error?: string;
}

async function runTests() {
  console.log('🧪 Starting Knowledge Agent Testing...\n');
  console.log(`📊 Total queries: ${testQueries.length}\n`);
  console.log('═'.repeat(80));

  const results: TestResult[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    console.log(`\n[${i + 1}/${testQueries.length}] Testing: "${test.query}"`);
    console.log(`Category: ${test.category} | Expected: ${test.expectedRelevance}`);

    const startTime = Date.now();

    try {
      const response = await knowledgeAgent.query({
        query: test.query,
        role: 'clinician',
        max_results: 5,
      });

      const latency = Date.now() - startTime;

      const result: TestResult = {
        query: test.query,
        category: test.category,
        expectedRelevance: test.expectedRelevance,
        status: response.status,
        citationCount: response.citations.length,
        latency,
        answer: response.answer.slice(0, 150) + '...',
        topCitation: response.citations[0]?.document_title,
      };

      results.push(result);

      // Evaluate success
      const isSuccess =
        (test.expectedRelevance === 'high' && response.citations.length >= 3) ||
        (test.expectedRelevance === 'medium' && response.citations.length >= 1) ||
        (test.expectedRelevance === 'low' && response.status !== 'success');

      if (isSuccess) {
        successCount++;
        console.log(`✅ PASS - ${response.citations.length} citations, ${latency}ms`);
      } else {
        failCount++;
        console.log(`❌ FAIL - ${response.citations.length} citations, ${latency}ms`);
      }

      console.log(`Status: ${response.status}`);
      console.log(`Answer: ${response.answer.slice(0, 100)}...`);
      if (response.citations.length > 0) {
        console.log(`Top citation: ${response.citations[0].document_title}`);
      }

    } catch (error: any) {
      const latency = Date.now() - startTime;
      failCount++;

      results.push({
        query: test.query,
        category: test.category,
        expectedRelevance: test.expectedRelevance,
        status: 'error',
        citationCount: 0,
        latency,
        answer: '',
        error: error.message,
      });

      console.log(`❌ ERROR - ${error.message}`);
    }

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '═'.repeat(80));
  console.log('\n📊 TEST SUMMARY\n');
  console.log(`Total queries: ${testQueries.length}`);
  console.log(`✅ Passed: ${successCount} (${Math.round(successCount / testQueries.length * 100)}%)`);
  console.log(`❌ Failed: ${failCount} (${Math.round(failCount / testQueries.length * 100)}%)`);

  // Calculate statistics
  const latencies = results.map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const maxLatency = Math.max(...latencies);
  const minLatency = Math.min(...latencies);

  console.log('\n⏱️  LATENCY STATISTICS\n');
  console.log(`Average: ${avgLatency.toFixed(0)}ms`);
  console.log(`Min: ${minLatency}ms`);
  console.log(`Max: ${maxLatency}ms`);
  console.log(`Target: < 3000ms`);
  console.log(`Status: ${avgLatency < 3000 ? '✅ PASS' : '❌ FAIL'}`);

  // Citation statistics
  const citationCounts = results.map(r => r.citationCount);
  const avgCitations = citationCounts.reduce((a, b) => a + b, 0) / citationCounts.length;

  console.log('\n📚 CITATION STATISTICS\n');
  console.log(`Average citations per query: ${avgCitations.toFixed(1)}`);
  console.log(`Queries with 0 citations: ${citationCounts.filter(c => c === 0).length}`);
  console.log(`Queries with 3+ citations: ${citationCounts.filter(c => c >= 3).length}`);

  // Status breakdown
  const statusCounts = results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📋 STATUS BREAKDOWN\n');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`${status}: ${count} (${Math.round(count / results.length * 100)}%)`);
  });

  // Category performance
  console.log('\n🏷️  CATEGORY PERFORMANCE\n');
  const categoryStats = results.reduce((acc, r) => {
    if (!acc[r.category]) {
      acc[r.category] = { total: 0, success: 0 };
    }
    acc[r.category].total++;
    if (r.citationCount > 0 || r.status === 'out_of_scope') {
      acc[r.category].success++;
    }
    return acc;
  }, {} as Record<string, { total: number; success: number }>);

  Object.entries(categoryStats).forEach(([category, stats]) => {
    const rate = Math.round(stats.success / stats.total * 100);
    console.log(`${category}: ${stats.success}/${stats.total} (${rate}%)`);
  });

  console.log('\n' + '═'.repeat(80));
  console.log('\n✅ Testing complete!\n');

  // Write detailed results to file
  const reportPath = '/mnt/e/project/webrag/apps/api/RAG_QUALITY_TEST_REPORT.md';
  const report = generateReport(results, {
    successCount,
    failCount,
    avgLatency,
    maxLatency,
    minLatency,
    avgCitations,
    statusCounts,
    categoryStats,
  });

  const fs = await import('fs/promises');
  await fs.writeFile(reportPath, report, 'utf-8');
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}

function generateReport(
  results: TestResult[],
  stats: {
    successCount: number;
    failCount: number;
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
    avgCitations: number;
    statusCounts: Record<string, number>;
    categoryStats: Record<string, { total: number; success: number }>;
  }
): string {
  const timestamp = new Date().toISOString();

  return `# RAG Quality Test Report

**Date:** ${timestamp}
**Agent:** BE2 (Backend Agent 2)
**Test Suite:** Knowledge Agent Integration Testing

---

## Executive Summary

Knowledge Agent đã được test với ${results.length} medical queries covering các categories khác nhau.

**Overall Results:**
- ✅ Passed: ${stats.successCount}/${results.length} (${Math.round(stats.successCount / results.length * 100)}%)
- ❌ Failed: ${stats.failCount}/${results.length} (${Math.round(stats.failCount / results.length * 100)}%)
- ⏱️ Average Latency: ${stats.avgLatency.toFixed(0)}ms (target: < 3000ms)
- 📚 Average Citations: ${stats.avgCitations.toFixed(1)} per query

**Status:** ${stats.successCount / results.length >= 0.8 ? '✅ PASS' : '⚠️ NEEDS IMPROVEMENT'}

---

## Performance Metrics

### Latency Statistics

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Average | ${stats.avgLatency.toFixed(0)}ms | < 3000ms | ${stats.avgLatency < 3000 ? '✅' : '❌'} |
| Min | ${stats.minLatency}ms | - | - |
| Max | ${stats.maxLatency}ms | - | - |

### Citation Statistics

| Metric | Value |
|--------|-------|
| Average citations per query | ${stats.avgCitations.toFixed(1)} |
| Queries with 0 citations | ${results.filter(r => r.citationCount === 0).length} |
| Queries with 3+ citations | ${results.filter(r => r.citationCount >= 3).length} |

---

## Status Breakdown

${Object.entries(stats.statusCounts).map(([status, count]) =>
  `- **${status}**: ${count} (${Math.round(count / results.length * 100)}%)`
).join('\n')}

---

## Category Performance

${Object.entries(stats.categoryStats).map(([category, stat]) => {
  const rate = Math.round(stat.success / stat.total * 100);
  return `- **${category}**: ${stat.success}/${stat.total} (${rate}%)`;
}).join('\n')}

---

## Detailed Results

${results.map((r, i) => `
### Query ${i + 1}: ${r.query}

- **Category:** ${r.category}
- **Expected Relevance:** ${r.expectedRelevance}
- **Status:** ${r.status}
- **Citations:** ${r.citationCount}
- **Latency:** ${r.latency}ms
- **Top Citation:** ${r.topCitation || 'N/A'}
- **Answer Preview:** ${r.answer}
${r.error ? `- **Error:** ${r.error}` : ''}
`).join('\n---\n')}

---

## Recommendations

### High Priority

${stats.avgLatency > 3000 ? '- ⚠️ **Optimize latency**: Average latency exceeds 3s target. Consider caching or batch optimization.' : '- ✅ Latency within target'}
${stats.avgCitations < 2 ? '- ⚠️ **Improve retrieval**: Average citations below 2. Consider adjusting similarity threshold or chunk size.' : '- ✅ Citation count acceptable'}
${stats.successCount / results.length < 0.8 ? '- ⚠️ **Improve accuracy**: Success rate below 80%. Review failed queries and adjust retrieval strategy.' : '- ✅ Accuracy acceptable'}

### Medium Priority

- Add user feedback loop for citation relevance
- Implement re-ranking for better result ordering
- Test with more diverse medical queries
- Monitor embedding generation performance

### Low Priority

- Experiment with different chunking strategies
- Test alternative embedding models
- Implement query expansion
- Add semantic caching

---

## Conclusion

${stats.successCount / results.length >= 0.8 && stats.avgLatency < 3000
  ? 'Knowledge Agent is performing well and ready for production use with real clinical queries.'
  : 'Knowledge Agent needs optimization before production deployment. Focus on the high-priority recommendations above.'}

---

**Report Generated:** ${timestamp}
**Author:** BE2 (Backend Agent 2)
**Status:** ${stats.successCount / results.length >= 0.8 ? '✅ READY' : '⚠️ NEEDS WORK'}
`;
}

// Run tests
runTests().catch((error) => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
