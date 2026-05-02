/**
 * Simple Embedding Test
 */

import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env BEFORE importing anything else
dotenv.config({ path: resolve(__dirname, '../../.env') });

console.log('Environment check:');
console.log('  OLLAMA_URL:', process.env.OLLAMA_URL);
console.log('  OLLAMA_MODEL:', process.env.OLLAMA_MODEL);
console.log();

// Now import embedding client
const { EmbeddingClient } = await import('../lib/embedding/client.js');

async function testEmbedding() {
  console.log('🧪 Testing Embedding Client...\n');

  const client = new EmbeddingClient();

  console.log('Testing connection...');
  const connected = await client.testConnection();

  if (connected) {
    console.log('✅ Embedding client working!\n');

    // Test actual embedding
    console.log('Generating test embedding...');
    const result = await client.generateEmbedding('viêm phổi ở trẻ em');
    console.log(`✅ Embedding generated: ${result.embedding.length} dimensions\n`);
  } else {
    console.log('❌ Embedding client not working\n');
  }
}

testEmbedding()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
