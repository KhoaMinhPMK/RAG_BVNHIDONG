/**
 * Test Knowledge Agent End-to-End
 *
 * Test real medical queries through Knowledge Agent
 */

import { knowledgeAgent } from '../agents/knowledge.js';
import { logger } from '../utils/logger.js';

const testQueries = [
  {
    query: 'Triệu chứng viêm phổi ở trẻ em là gì?',
    role: 'clinician',
  },
  {
    query: 'Cách chẩn đoán viêm phổi qua X-quang?',
    role: 'radiologist',
  },
  {
    query: 'Consolidation trên phim X-quang có nghĩa là gì?',
    role: 'clinician',
  },
];

async function testKnowledgeAgent() {
  console.log('🧪 Testing Knowledge Agent End-to-End...\n');

  let successCount = 0;
  let totalLatency = 0;

  for (let i = 0; i < testQueries.length; i++) {
    const test = testQueries[i];
    console.log(`${i + 1}️⃣ Query: "${test.query}"`);
    console.log(`   Role: ${test.role}`);

    const startTime = Date.now();

    try {
      const result = await knowledgeAgent.query({
        query: test.query,
        role: test.role as any,
      });

      const latency = Date.now() - startTime;
      totalLatency += latency;

      console.log(`   ✅ Status: ${result.status}`);
      console.log(`   ⏱️  Latency: ${latency}ms`);
      console.log(`   📚 Citations: ${result.citations.length}`);
      console.log(`   📝 Answer: ${result.answer.substring(0, 100)}...`);

      if (result.status === 'success') {
        successCount++;
      }

      console.log();
    } catch (error) {
      console.log(`   ❌ Error: ${(error as Error).message}`);
      console.log();
    }
  }

  // Summary
  console.log('📊 Test Summary:');
  console.log(`   Total queries: ${testQueries.length}`);
  console.log(`   Successful: ${successCount}`);
  console.log(`   Failed: ${testQueries.length - successCount}`);
  console.log(`   Success rate: ${Math.round((successCount / testQueries.length) * 100)}%`);
  console.log(`   Average latency: ${Math.round(totalLatency / testQueries.length)}ms`);
  console.log();

  if (successCount === testQueries.length) {
    console.log('✅ Knowledge Agent is FULLY OPERATIONAL!');
    console.log('🔗 Ready for frontend integration\n');
  } else if (successCount > 0) {
    console.log('⚠️  Knowledge Agent partially working');
    console.log('📋 Some queries failed - check logs for details\n');
  } else {
    console.log('❌ Knowledge Agent not working');
    console.log('📋 All queries failed - check configuration\n');
  }
}

testKnowledgeAgent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
