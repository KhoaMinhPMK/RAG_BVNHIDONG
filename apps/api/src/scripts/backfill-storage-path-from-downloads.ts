#!/usr/bin/env tsx
/**
 * Set documents.metadata.storage_path to knowledge-docs/downloads/<file>.pdf
 * when document.checksum matches a PDF in knowledge_base/downloads.
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { supabase } from '../lib/supabase/client.js';
import { pdfParser } from '../lib/ingestion/pdf-parser.js';

function sanitizeKeySegment(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, '../../../..');
  const downloadsDir = path.join(repoRoot, 'knowledge_base', 'downloads');

  const entries = await fs.readdir(downloadsDir, { withFileTypes: true });
  const pdfs = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.pdf'));

  const checksumToStoragePath = new Map<string, string>();
  for (const e of pdfs) {
    const full = path.join(downloadsDir, e.name);
    const parsed = await pdfParser.parsePDF(full);
    const checksum = pdfParser.calculateContentHash(parsed.content);
    const storagePath = `downloads/${sanitizeKeySegment(e.name)}`;
    checksumToStoragePath.set(checksum, storagePath);
    console.log(`Indexed ${e.name} → ${storagePath} (${checksum.slice(0, 12)}…)`);
  }

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, title, checksum, metadata');

  if (error) throw new Error(error.message);

  let updated = 0;
  for (const doc of documents ?? []) {
    if (!doc.checksum) continue;
    const sp = checksumToStoragePath.get(doc.checksum);
    if (!sp) continue;
    const meta = (doc.metadata as Record<string, unknown> | null) ?? {};
    if (meta.storage_path === sp) continue;
    const nextMeta = { ...meta, storage_path: sp };
    const { error: upErr } = await supabase.from('documents').update({ metadata: nextMeta }).eq('id', doc.id);
    if (upErr) {
      console.error(`Failed ${doc.id}: ${upErr.message}`);
      continue;
    }
    updated += 1;
    console.log(`Updated "${doc.title}" → ${sp}`);
  }

  console.log(`\nDone. Updated ${updated} document(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
