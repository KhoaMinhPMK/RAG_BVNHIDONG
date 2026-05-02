#!/usr/bin/env node
/**
 * Document Ingestion CLI Script
 *
 * Usage:
 *   node src/scripts/ingest-documents.ts <file-or-directory>
 *   node src/scripts/ingest-documents.ts knowledge_base/documents/
 *   node src/scripts/ingest-documents.ts knowledge_base/documents/guideline.pdf
 *
 * Options:
 *   --max-tokens <number>     Max tokens per chunk (default: 512)
 *   --overlap <number>        Overlap tokens between chunks (default: 50)
 *   --batch-size <number>     Embedding batch size (default: 10)
 *   --skip-existing           Skip documents that already exist (default: true)
 *   --force                   Re-ingest even if document exists
 */

// Load environment variables FIRST
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import { ingestionService } from '../lib/ingestion/service.js';
import { embeddingClient } from '../lib/embedding/client.js';
import { logger } from '../lib/utils/logger.js';

// ============================================================================
// CLI Arguments Parsing
// ============================================================================

interface CLIArgs {
  inputPath: string;
  maxTokens: number;
  overlap: number;
  batchSize: number;
  skipExisting: boolean;
}

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Error: No input path provided');
    console.log('\nUsage:');
    console.log('  node src/scripts/ingest-documents.ts <file-or-directory>');
    console.log('\nOptions:');
    console.log('  --max-tokens <number>     Max tokens per chunk (default: 512)');
    console.log('  --overlap <number>        Overlap tokens (default: 50)');
    console.log('  --batch-size <number>     Embedding batch size (default: 10)');
    console.log('  --skip-existing           Skip existing documents (default: true)');
    console.log('  --force                   Re-ingest existing documents');
    process.exit(1);
  }

  const inputPath = args[0];
  let maxTokens = 512;
  let overlap = 50;
  let batchSize = 10;
  let skipExisting = true;

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--max-tokens':
        maxTokens = parseInt(args[++i], 10);
        break;
      case '--overlap':
        overlap = parseInt(args[++i], 10);
        break;
      case '--batch-size':
        batchSize = parseInt(args[++i], 10);
        break;
      case '--skip-existing':
        skipExisting = true;
        break;
      case '--force':
        skipExisting = false;
        break;
    }
  }

  return { inputPath, maxTokens, overlap, batchSize, skipExisting };
}

// ============================================================================
// File Discovery
// ============================================================================

async function findPDFs(inputPath: string): Promise<string[]> {
  const stats = await fs.stat(inputPath);

  if (stats.isFile()) {
    if (inputPath.toLowerCase().endsWith('.pdf')) {
      return [path.resolve(inputPath)];
    } else {
      throw new Error('Input file must be a PDF');
    }
  }

  if (stats.isDirectory()) {
    const files: string[] = [];
    const entries = await fs.readdir(inputPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(inputPath, entry.name);

      if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
        files.push(path.resolve(fullPath));
      } else if (entry.isDirectory()) {
        // Recursive search
        const subFiles = await findPDFs(fullPath);
        files.push(...subFiles);
      }
    }

    return files;
  }

  throw new Error('Input path must be a file or directory');
}

// ============================================================================
// Main Ingestion Function
// ============================================================================

async function main() {
  console.log('🚀 RAG Document Ingestion Pipeline\n');

  // Parse CLI arguments
  const args = parseArgs();

  console.log('📋 Configuration:');
  console.log(`   Input: ${args.inputPath}`);
  console.log(`   Max Tokens: ${args.maxTokens}`);
  console.log(`   Overlap: ${args.overlap}`);
  console.log(`   Batch Size: ${args.batchSize}`);
  console.log(`   Skip Existing: ${args.skipExisting}`);
  console.log('');

  // Test embedding connection
  console.log('🔗 Testing embedding service connection...');
  const connectionOk = await embeddingClient.testConnection();

  if (!connectionOk) {
    console.error('❌ Failed to connect to embedding service');
    console.error('   Make sure Ollama is running and nomic-embed-text model is available');
    console.error('   Run: ollama pull nomic-embed-text');
    process.exit(1);
  }

  const embeddingDim = await embeddingClient.getEmbeddingDimension();
  console.log(`✅ Embedding service connected (dimension: ${embeddingDim})\n`);

  // Find PDF files
  console.log('📂 Discovering PDF files...');
  const pdfFiles = await findPDFs(args.inputPath);

  if (pdfFiles.length === 0) {
    console.log('⚠️  No PDF files found');
    process.exit(0);
  }

  console.log(`✅ Found ${pdfFiles.length} PDF file(s)\n`);

  // Display files
  console.log('📄 Files to ingest:');
  pdfFiles.forEach((file, idx) => {
    console.log(`   ${idx + 1}. ${path.basename(file)}`);
  });
  console.log('');

  // Start ingestion
  console.log('⚙️  Starting ingestion...\n');

  const startTime = Date.now();

  const results = await ingestionService.ingestBatch(pdfFiles, {
    chunking: {
      max_tokens: args.maxTokens,
      overlap_tokens: args.overlap,
      preserve_sentences: true,
      preserve_paragraphs: true,
    },
    batch_size: args.batchSize,
    skip_existing: args.skipExisting,
  });

  const duration = Date.now() - startTime;

  // Display results
  console.log('\n📊 Ingestion Results:\n');

  const successful = results.filter(r => r.result.success);
  const failed = results.filter(r => !r.result.success);

  console.log(`✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`⏱️  Total Time: ${(duration / 1000).toFixed(2)}s\n`);

  if (successful.length > 0) {
    console.log('✅ Successfully ingested:');
    successful.forEach(({ filePath, result }) => {
      console.log(`   • ${path.basename(filePath)}`);
      console.log(`     - Document ID: ${result.document_id}`);
      console.log(`     - Chunks: ${result.chunks_created}`);
      console.log(`     - Embeddings: ${result.embeddings_created}`);
      console.log(`     - Tokens: ${result.total_tokens}`);
      console.log(`     - Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
    });
    console.log('');
  }

  if (failed.length > 0) {
    console.log('❌ Failed to ingest:');
    failed.forEach(({ filePath, result }) => {
      console.log(`   • ${path.basename(filePath)}`);
      console.log(`     - Error: ${result.error}`);
    });
    console.log('');
  }

  // Summary stats
  const totalChunks = successful.reduce((sum, r) => sum + r.result.chunks_created, 0);
  const totalTokens = successful.reduce((sum, r) => sum + r.result.total_tokens, 0);

  console.log('📈 Summary:');
  console.log(`   Total Documents: ${successful.length}`);
  console.log(`   Total Chunks: ${totalChunks}`);
  console.log(`   Total Tokens: ${totalTokens.toLocaleString()}`);
  console.log(`   Avg Chunks/Doc: ${(totalChunks / successful.length).toFixed(1)}`);
  console.log(`   Avg Tokens/Chunk: ${(totalTokens / totalChunks).toFixed(0)}`);
  console.log('');

  console.log('✅ Ingestion complete!');

  process.exit(failed.length > 0 ? 1 : 0);
}

// ============================================================================
// Run
// ============================================================================

main().catch(error => {
  console.error('❌ Fatal error:', error);
  logger.error('Ingestion script failed', { error });
  process.exit(1);
});
