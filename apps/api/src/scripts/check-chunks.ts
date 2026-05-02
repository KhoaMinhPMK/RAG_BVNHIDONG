/**
 * Check chunks in both possible table names
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkChunks() {
  console.log('🔍 Checking chunks in database...\n');

  // Try 'chunks' table (BE2 might have renamed it)
  console.log('1️⃣ Checking table "chunks"...');
  const { data: chunks1, error: err1, count: count1 } = await supabase
    .from('chunks')
    .select('id, document_id, content', { count: 'exact' })
    .limit(3);

  if (err1) {
    console.log(`   ❌ Error: ${err1.message}\n`);
  } else {
    console.log(`   ✅ Found ${count1 || 0} chunks`);
    if (chunks1 && chunks1.length > 0) {
      console.log(`   Sample: ${chunks1[0].content?.substring(0, 100)}...\n`);
    }
  }

  // Try 'document_chunks' table (original name)
  console.log('2️⃣ Checking table "document_chunks"...');
  const { data: chunks2, error: err2, count: count2 } = await supabase
    .from('document_chunks')
    .select('id, document_id, content', { count: 'exact' })
    .limit(3);

  if (err2) {
    console.log(`   ❌ Error: ${err2.message}\n`);
  } else {
    console.log(`   ✅ Found ${count2 || 0} chunks`);
    if (chunks2 && chunks2.length > 0) {
      console.log(`   Sample: ${chunks2[0].content?.substring(0, 100)}...\n`);
    }
  }

  // Summary
  console.log('📊 Summary:');
  console.log(`   chunks: ${count1 || 0}`);
  console.log(`   document_chunks: ${count2 || 0}`);
  console.log(`   Total: ${(count1 || 0) + (count2 || 0)}\n`);

  if ((count1 || 0) === 0 && (count2 || 0) === 0) {
    console.log('⚠️  No chunks found in either table');
    console.log('💡 BE2 may have tested on different database or chunks not committed yet\n');
  }
}

checkChunks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
