/**
 * Test script for MiMo API integration
 * Usage: tsx src/scripts/test-mimo.ts
 */

import 'dotenv/config';
import { getMiMoClient } from '../lib/mimo/client';
import { getLLMRacer } from '../lib/llm/racing';

async function testMiMoClient() {
  console.log('\n🧪 Testing MiMo Client...\n');

  const client = getMiMoClient();

  // Test 1: Health check
  console.log('1️⃣ Health Check...');
  try {
    const isHealthy = await client.isAvailable();
    console.log(`   ✅ Health check: ${isHealthy ? 'PASS' : 'FAIL'}`);
  } catch (error) {
    console.error('   ❌ Health check failed:', (error as Error).message);
  }

  // Test 2: Simple chat
  console.log('\n2️⃣ Simple Chat (mimo-v2.5-pro)...');
  try {
    const response = await client.chat([
      { role: 'system', content: 'You are a helpful medical AI assistant.' },
      { role: 'user', content: 'What is pneumonia?' },
    ], { max_tokens: 200 });

    console.log('   ✅ Chat response:');
    console.log('   Model:', response.model);
    console.log('   Tokens:', response.usage.total_tokens);
    console.log('   Response:', response.choices[0]?.message?.content.substring(0, 150) + '...');
  } catch (error) {
    console.error('   ❌ Chat failed:', (error as Error).message);
  }

  // Test 3: Fallback model
  console.log('\n3️⃣ Fallback Model (mimo-v2.5)...');
  try {
    const response = await client.chat([
      { role: 'user', content: 'Hello, how are you?' },
    ], { max_tokens: 50 }, 'mimo-v2.5');

    console.log('   ✅ Fallback response:');
    console.log('   Model:', response.model);
    console.log('   Response:', response.choices[0]?.message?.content);
  } catch (error) {
    console.error('   ❌ Fallback failed:', (error as Error).message);
  }

  console.log('\n✅ MiMo Client tests completed!\n');
}

async function testLLMRacing() {
  console.log('\n🏁 Testing LLM Racing Strategy...\n');

  const racer = getLLMRacer();

  const query = 'What are the common symptoms of tuberculosis?';
  const context = `Tuberculosis (TB) is an infectious disease caused by Mycobacterium tuberculosis.
Common symptoms include persistent cough, fever, night sweats, and weight loss.`;

  console.log('Query:', query);
  console.log('Context:', context.substring(0, 100) + '...\n');

  // Test 1: Normal race
  console.log('1️⃣ Normal Race (first wins)...');
  try {
    const result = await racer.race(query, context, {
      timeout: 30000,
      storeComparison: true,
    });

    console.log('   ✅ Race completed!');
    console.log('   Winner:', result.winner);
    console.log('   Response:', result.response.substring(0, 150) + '...');
    console.log('   Ollama time:', result.ollamaTime ? `${result.ollamaTime}ms` : 'N/A');
    console.log('   MiMo time:', result.mimoTime ? `${result.mimoTime}ms` : 'N/A');
  } catch (error) {
    console.error('   ❌ Race failed:', (error as Error).message);
  }

  // Test 2: Prefer Ollama (privacy mode)
  console.log('\n2️⃣ Privacy Mode (prefer Ollama)...');
  try {
    const result = await racer.race(query, context, {
      timeout: 30000,
      preferOllama: true,
      storeComparison: true,
    });

    console.log('   ✅ Privacy mode completed!');
    console.log('   Winner:', result.winner);
    console.log('   Response:', result.response.substring(0, 150) + '...');
  } catch (error) {
    console.error('   ❌ Privacy mode failed:', (error as Error).message);
  }

  console.log('\n✅ LLM Racing tests completed!\n');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🤖 MiMo API Integration Test Suite');
  console.log('═══════════════════════════════════════════════════════');

  // Check environment variables
  console.log('\n📋 Environment Check:');
  console.log('   MIMO_API_KEY:', process.env.MIMO_API_KEY ? '✅ Set' : '❌ Missing');
  console.log('   MIMO_BASE_URL:', process.env.MIMO_BASE_URL || '❌ Missing');
  console.log('   OLLAMA_URL:', process.env.OLLAMA_URL || '❌ Missing');

  if (!process.env.MIMO_API_KEY) {
    console.error('\n❌ MIMO_API_KEY not set. Please update .env file.');
    process.exit(1);
  }

  try {
    // Test MiMo client
    await testMiMoClient();

    // Test LLM racing
    await testLLMRacing();

    console.log('═══════════════════════════════════════════════════════');
    console.log('✅ All tests completed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
