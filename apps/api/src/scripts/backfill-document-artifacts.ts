#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';

import { supabase } from '../lib/supabase/client.js';
import { pdfParser } from '../lib/ingestion/pdf-parser.js';

type DocumentRow = {
  id: string;
  title: string;
  source: string | null;
  checksum: string | null;
  metadata: Record<string, any> | null;
};

async function findPdfArtifacts(downloadsDir: string) {
  const entries = await fs.readdir(downloadsDir, { withFileTypes: true });
  const pdfPaths = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
    .map((entry) => path.join(downloadsDir, entry.name));

  const artifactsByChecksum = new Map<
    string,
    { path: string; originalName: string; title: string; source: string }
  >();

  for (const pdfPath of pdfPaths) {
    const parsed = await pdfParser.parsePDF(pdfPath);
    const checksum = pdfParser.calculateContentHash(parsed.content);

    artifactsByChecksum.set(checksum, {
      path: pdfPath,
      originalName: path.basename(pdfPath),
      title: parsed.metadata.title,
      source: parsed.metadata.source,
    });
  }

  return artifactsByChecksum;
}

async function main() {
  const downloadsDir = path.resolve('../../knowledge_base/downloads');
  console.log('🔁 Backfilling knowledge document source artifacts');
  console.log(`📁 Scanning PDFs under: ${downloadsDir}`);

  const artifactsByChecksum = await findPdfArtifacts(downloadsDir);
  console.log(`✅ Indexed ${artifactsByChecksum.size} local PDF artifacts by checksum`);

  const { data: documents, error } = await supabase
    .from('documents')
    .select('id, title, source, checksum, metadata')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load documents: ${error.message}`);
  }

  const missingArtifactDocs = ((documents ?? []) as DocumentRow[]).filter((document) => {
    const metadata = document.metadata ?? {};
    return !metadata.source_artifact_path;
  });

  let updated = 0;
  let unmatched = 0;

  for (const document of missingArtifactDocs) {
    if (!document.checksum) {
      unmatched += 1;
      console.log(`⚠️  Skip ${document.title} (${document.id.slice(0, 8)}): missing checksum`);
      continue;
    }

    const artifact = artifactsByChecksum.get(document.checksum);

    if (!artifact) {
      unmatched += 1;
      console.log(`⚠️  No local artifact matched checksum for ${document.title} (${document.id.slice(0, 8)})`);
      continue;
    }

    const nextMetadata = {
      ...(document.metadata ?? {}),
      source_artifact_path: artifact.path,
      source_artifact_original_name: artifact.originalName,
      source_artifact_managed: false,
      source_artifact_backfilled_at: new Date().toISOString(),
      source_artifact_backfill_source: 'checksum-match',
    };

    const { error: updateError } = await supabase
      .from('documents')
      .update({ metadata: nextMetadata })
      .eq('id', document.id);

    if (updateError) {
      throw new Error(`Failed to update ${document.id}: ${updateError.message}`);
    }

    updated += 1;
    console.log(`✅ Backfilled ${document.title} -> ${artifact.originalName}`);
  }

  console.log('\n📊 Summary');
  console.log(`   Documents scanned: ${(documents ?? []).length}`);
  console.log(`   Missing artifacts: ${missingArtifactDocs.length}`);
  console.log(`   Backfilled: ${updated}`);
  console.log(`   Unmatched: ${unmatched}`);
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});