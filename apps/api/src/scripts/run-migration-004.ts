/**
 * Migration script: 004_fix_draft_reports
 * Chạy: npx tsx src/scripts/run-migration-004.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runSql(label: string, sql: string) {
  console.log(`Running: ${label}...`);
  const { error } = await supabase.rpc('exec_sql' as any, { query: sql }).single();
  if (error) {
    // Try direct REST approach
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      console.warn(`  ⚠️  ${label}: RPC not available (normal), check manually`);
      return;
    }
  }
  console.log(`  ✅ ${label}`);
}

async function migrate() {
  console.log('=== Migration 004: Fix draft_reports ===\n');

  // Check if template_id is already nullable by trying to insert with null
  const testId = '00000000-0000-0000-0000-000000000000';
  const testEpId = '00000000-0000-0000-0000-000000000001';

  // Print the SQL to run manually if RPC is not available
  const fs = await import('fs');
  const path = await import('path');
  const sqlPath = path.resolve(process.cwd(), 'supabase-migrations/004_fix_draft_reports.sql');

  let sql = '';
  try {
    sql = fs.readFileSync(sqlPath, 'utf-8');
  } catch {
    console.error('Cannot read SQL file');
    process.exit(1);
  }

  console.log('Please run the following SQL in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/mibtdruhmmcatccdzjjk/sql/new\n');
  console.log('──────── SQL to paste ────────');
  console.log(sql);
  console.log('──────────────────────────────');
  console.log('\nAfter applying, restart the backend: npm run dev');
}

migrate().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});
