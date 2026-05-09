#!/usr/bin/env node
/**
 * Ingest every PDF under repo knowledge_base/downloads (parse → chunk → embed → DB),
 * then upload originals to Supabase Storage (same pipeline as API upload).
 *
 * Run from apps/api:
 *   yarn tsx src/scripts/sync-knowledge-downloads.ts
 *   yarn tsx src/scripts/sync-knowledge-downloads.ts --force
 *
 * Env:
 *   KNOWLEDGE_DOWNLOADS_DIR — override directory (default: ../../knowledge_base/downloads from cwd)
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { ingestionService } from '../lib/ingestion/service.js';
import { embeddingClient } from '../lib/embedding/client.js';
import { logger } from '../lib/utils/logger.js';

function defaultDownloadsDir(): string {
  const fromEnv = process.env.KNOWLEDGE_DOWNLOADS_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.resolve(process.cwd(), '..', '..', 'knowledge_base', 'downloads');
}

async function listPdfsRecursive(dir: string): Promise<string[]> {
  const out: string[] = [];
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    throw new Error(`Cannot read downloads directory "${dir}": ${e instanceof Error ? e.message : e}`);
  }

  for (const name of names) {
    const full = path.join(dir, name);
    const st = await fs.stat(full);
    if (st.isDirectory()) {
      out.push(...(await listPdfsRecursive(full)));
    } else if (st.isFile() && name.toLowerCase().endsWith('.pdf')) {
      out.push(path.resolve(full));
    }
  }
  return out;
}

async function main() {
  const force = process.argv.includes('--force');
  const skipExisting = !force;

  const downloadsDir = defaultDownloadsDir();
  console.log('📂 Knowledge downloads directory:', downloadsDir);
  console.log(`   skip_existing: ${skipExisting} (pass --force to re-ingest)\n`);

  console.log('🔗 Testing embedding service...');
  const ok = await embeddingClient.testConnection();
  if (!ok) {
    console.error('❌ Embedding service unreachable. Start Ollama and pull nomic-embed-text.');
    process.exit(1);
  }
  const dim = await embeddingClient.getEmbeddingDimension();
  console.log(`✅ Embedding OK (dimension ${dim})\n`);

  const pdfs = await listPdfsRecursive(downloadsDir);
  if (pdfs.length === 0) {
    console.log('⚠️  No PDF files found.');
    process.exit(0);
  }

  console.log(`📄 Found ${pdfs.length} PDF(s)\n`);

  const results: Array<{ file: string; ok: boolean; id?: string; err?: string }> = [];

  for (const filePath of pdfs) {
    const base = path.basename(filePath);
    console.log(`⏳ ${base} …`);
    try {
      const result = await ingestionService.ingestDocument(filePath, {
        skip_existing: skipExisting,
        metadataOverride: { source: 'Other' },
        sourceArtifact: {
          path: filePath,
          original_name: base,
          managed: false,
        },
        chunking: {
          max_tokens: 512,
          overlap_tokens: 50,
          preserve_sentences: true,
          preserve_paragraphs: true,
        },
        batch_size: 10,
      });
      if (result.success) {
        console.log(`   ✅ document_id=${result.document_id} chunks=${result.chunks_created}`);
        results.push({ file: filePath, ok: true, id: result.document_id });
      } else {
        console.log(`   ❌ ${result.error}`);
        results.push({ file: filePath, ok: false, err: result.error });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`   ❌ ${msg}`);
      results.push({ file: filePath, ok: false, err: msg });
      logger.error('sync-knowledge-downloads file failed', { filePath, error: msg });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n📊 Done. OK: ${results.length - failed}, failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
