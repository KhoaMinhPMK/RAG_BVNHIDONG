/**
 * Simple MiMo API test
 * Usage: tsx src/scripts/test-mimo-simple.ts
 */

import 'dotenv/config';

async function testMiMoAPI() {
  console.log('🧪 Testing MiMo API...\n');

  const apiKey = process.env.MIMO_API_KEY;
  const baseUrl = process.env.MIMO_BASE_URL || 'https://token-plan-sgp.xiaomimomo.com/v1';

  if (!apiKey) {
    console.error('❌ MIMO_API_KEY not set');
    process.exit(1);
  }

  console.log('API Key:', apiKey.substring(0, 10) + '...');
  console.log('Base URL:', baseUrl);
  console.log('');

  // Test 1: List models
  console.log('1️⃣ Testing /models endpoint...');
  try {
    const response = await fetch(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log('Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Models endpoint works!');
      console.log('Available models:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.error('❌ Models endpoint failed:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', (error as Error).message);
  }

  // Test 2: Simple chat
  console.log('\n2️⃣ Testing /chat/completions endpoint...');
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiMo-V2.5-Pro',
        messages: [
          { role: 'user', content: 'Say hello in one sentence.' },
        ],
        max_tokens: 50,
        temperature: 0.7,
      }),
    });

    console.log('Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Chat endpoint works!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const error = await response.text();
      console.error('❌ Chat endpoint failed:', error);
    }
  } catch (error) {
    console.error('❌ Request failed:', (error as Error).message);
  }

  console.log('\n✅ Test completed!');
}

testMiMoAPI();
