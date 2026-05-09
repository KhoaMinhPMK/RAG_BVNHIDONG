#!/usr/bin/env tsx
/**
 * Upload all PDFs from knowledge_base/downloads to Supabase Storage (knowledge-docs).
 * Object keys: downloads/<filename>
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'knowledge-docs';

function repoRootFromScript(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, '../../../..');
}

function sanitizeKeySegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function main() {
  const repoRoot = repoRootFromScript();
  const downloadsDir = path.join(repoRoot, 'knowledge_base', 'downloads');

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const entries = await fs.readdir(downloadsDir, { withFileTypes: true }).catch(() => []);
  const pdfs = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'));

  if (pdfs.length === 0) {
    console.log(`No PDF files found in ${downloadsDir}`);
    process.exit(0);
  }

  console.log(`Uploading ${pdfs.length} PDF(s) to ${BUCKET}…`);
  console.log(`Source: ${downloadsDir}\n`);

  for (const e of pdfs) {
    const localPath = path.join(downloadsDir, e.name);
    const storagePath = `downloads/${sanitizeKeySegment(e.name)}`;
    const buf = await fs.readFile(localPath);

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
      contentType: 'application/pdf',
      upsert: true,
    });

    if (error) {
      console.error(`✗ ${e.name} → ${storagePath}: ${error.message}`);
    } else {
      console.log(`✓ ${e.name} → ${storagePath} (${buf.length} bytes)`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
