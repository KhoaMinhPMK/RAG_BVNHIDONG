/**
 * Test script: Verify backend API endpoints work with real Supabase auth
 *
 * Usage:
 * npx tsx src/test-auth.ts
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mibtdruhmmcatccdzjjk.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_lmqX6atRgaSLPrZdwexcMw_fJU0_04t';
const API_BASE = 'http://localhost:3001';

// Test credentials (must exist in Supabase Auth + profiles table)
const TEST_EMAIL = 'test@bvnhidong.vn';
const TEST_PASSWORD = 'TestPass123!';

async function testAuth() {
  console.log('🧪 Testing Backend Authentication...\n');

  // Step 1: Create Supabase client and login
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('1️⃣ Attempting login...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authError) {
    console.error('❌ Login failed:', authError.message);
    console.log('\n⚠️  This is expected if test user doesn\'t exist in Supabase.');
    console.log('   To create test user, run in Supabase SQL editor:');
    console.log(`
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
VALUES ('${TEST_EMAIL}', crypt('${TEST_PASSWORD}', gen_salt('bf')), NOW());

INSERT INTO profiles (id, email, full_name, role, department)
VALUES (
  (SELECT id FROM auth.users WHERE email = '${TEST_EMAIL}'),
  '${TEST_EMAIL}',
  'Test User',
  'clinician',
  'Nhi Khoa'
);`);
    return;
  }

  console.log('✅ Login successful');
  const token = authData.session?.access_token;

  if (!token) {
    console.error('❌ No access token found');
    return;
  }

  console.log('2️⃣ Testing health endpoint...');
  const healthRes = await fetch(`${API_BASE}/health`);
  const healthData = await healthRes.json();
  console.log(`   Status: ${healthRes.status} - ${JSON.stringify(healthData)}`);

  console.log('\n3️⃣ Testing query endpoint (requires auth)...');
  const queryRes = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: 'Triệu chứng viêm phổi ở trẻ em?',
      role: 'clinician',
    }),
  });

  const queryData = await queryRes.json();
  console.log(`   Status: ${queryRes.status}`);
  console.log(`   Success: ${queryData.success}`);
  if (queryData.success) {
    console.log(`   Answer (first 200 chars): ${queryData.answer?.substring(0, 200)}...`);
    console.log(`   Citations: ${queryData.citations?.length || 0}`);
  } else {
    console.log(`   Error: ${queryData.error?.message}`);
  }

  console.log('\n4️⃣ Testing unauthorized access (no token)...');
  const unauthRes = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: 'Test query',
      role: 'clinician',
    }),
  });

  const unauthData = await unauthRes.json();
  console.log(`   Status: ${unauthRes.status}`);
  console.log(`   Expected: 401 - Got: ${unauthRes.status} ${unauthData.success === false ? '✅' : '❌'}`);

  console.log('\n5️⃣ Testing invalid token...');
  const invalidRes = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid_token_here',
    },
    body: JSON.stringify({
      query: 'Test query',
      role: 'clinician',
    }),
  });

  const invalidData = await invalidRes.json();
  console.log(`   Status: ${invalidRes.status}`);
  console.log(`   Expected: 401 - Got: ${invalidRes.status} ${invalidData.success === false ? '✅' : '❌'}`);

  console.log('\n✅ Authentication tests complete!');
}

// Run tests
testAuth().catch(console.error);
