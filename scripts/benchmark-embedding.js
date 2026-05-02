#!/usr/bin/env node

/**
 * Benchmark embedding performance trên A100
 * Test: single embedding, batch embedding, Vietnamese medical text
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'https://grew-hypothesis-mothers-flooring.trycloudflare.com';

const medicalTexts = [
  'Viêm phổi nặng ở trẻ em được định nghĩa khi có ít nhất một trong các dấu hiệu sau: co rút lồng ngực, thở rên, tím tái',
  'Fast breathing is defined as ≥60 breaths/minute in infants aged 0–2 months, ≥50 in those aged 2–12 months, and ≥40 in children aged 1–5 years',
  'Consolidation on chest X-ray in children presenting with fever and cough strongly supports bacterial pneumonia',
  'Tiêu chuẩn nhập viện viêm phổi nặng: SpO2 < 92%, nhịp thở nhanh, co kéo cơ hô hấp phụ',
  'WHO guideline recommends amoxicillin as first-line treatment for non-severe pneumonia in children'
];

async function embedSingle(text) {
  const start = Date.now();
  const response = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  });
  const data = await response.json();
  const latency = Date.now() - start;

  return {
    dimensions: data.embedding.length,
    latency,
    tokensPerSecond: Math.round((text.split(' ').length / latency) * 1000)
  };
}

async function benchmarkSingle() {
  console.log('=== Single Embedding Benchmark ===\n');

  for (let i = 0; i < medicalTexts.length; i++) {
    const text = medicalTexts[i];
    const result = await embedSingle(text);
    console.log(`Text ${i + 1} (${text.split(' ').length} words):`);
    console.log(`  Dimensions: ${result.dimensions}`);
    console.log(`  Latency: ${result.latency}ms`);
    console.log(`  Speed: ~${result.tokensPerSecond} tokens/sec\n`);
  }
}

async function benchmarkBatch() {
  console.log('\n=== Batch Embedding Benchmark ===\n');

  const start = Date.now();
  const promises = medicalTexts.map(text => embedSingle(text));
  const results = await Promise.all(promises);
  const totalLatency = Date.now() - start;

  console.log(`Batch size: ${medicalTexts.length}`);
  console.log(`Total latency: ${totalLatency}ms`);
  console.log(`Average per text: ${Math.round(totalLatency / medicalTexts.length)}ms`);
  console.log(`Throughput: ${Math.round((medicalTexts.length / totalLatency) * 1000)} texts/sec`);
}

async function main() {
  console.log('Ollama Embedding Benchmark');
  console.log('Model: nomic-embed-text');
  console.log(`URL: ${OLLAMA_URL}\n`);

  try {
    await benchmarkSingle();
    await benchmarkBatch();

    console.log('\n✅ Benchmark completed successfully');
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message);
    process.exit(1);
  }
}

main();
