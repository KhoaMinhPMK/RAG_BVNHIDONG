/**
 * Migration script: 003_ai_runs
 * Chạy: npx tsx src/scripts/run-migration-003.ts
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

async function tableExists(name: string): Promise<boolean> {
  const { data } = await supabase
    .from('information_schema.tables' as any)
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', name)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const { data } = await supabase
    .from('information_schema.columns' as any)
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .eq('column_name', column)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function migrate() {
  console.log('=== Migration 003: AI Runs ===\n');

  // ── 1. Test existing tables ──────────────────────────────────────────────────
  const aiRunsExists = await tableExists('ai_runs');
  const aiRunBlocksExists = await tableExists('ai_run_blocks');
  const queryResultsExists = await tableExists('query_results');

  if (aiRunsExists && aiRunBlocksExists && queryResultsExists) {
    const runIdExists = await columnExists('draft_reports', 'run_id');
    const approvedByExists = await columnExists('draft_reports', 'approved_by');
    if (runIdExists && approvedByExists) {
      console.log('✅ Migration 003 already applied — nothing to do.');
      process.exit(0);
    }
  }

  // ── 2. Try inserting a test record to check if tables exist ─────────────────
  if (!aiRunsExists) {
    console.log('❌ Table ai_runs does not exist yet.');
    console.log('\nPlease run the following SQL in Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/mibtdruhmmcatccdzjjk/sql/new\n');

    const fs = await import('fs');
    const path = await import('path');
    const sqlPath = path.resolve(process.cwd(), 'supabase-migrations/003_ai_runs.sql');

    try {
      const sql = fs.readFileSync(sqlPath, 'utf-8');
      console.log('──────── SQL to paste ────────');
      console.log(sql);
      console.log('──────────────────────────────');
    } catch {
      console.log('(Could not read SQL file, check supabase-migrations/003_ai_runs.sql)');
    }
    process.exit(1);
  }

  console.log('✅ ai_runs table exists');

  // ── 3. Verify all new columns on draft_reports ───────────────────────────────
  const cols = ['run_id', 'approved_by', 'approved_at', 'approval_note', 'signature_data'];
  for (const col of cols) {
    const exists = await columnExists('draft_reports', col);
    console.log(`  draft_reports.${col}: ${exists ? '✅' : '❌ MISSING'}`);
  }

  console.log('\n✅ Migration check complete.');
}

migrate().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});
