// Test Ollama integration for RAG system
require('dotenv').config();

const OLLAMA_URL = process.env.OLLAMA_URL || 'https://grew-hypothesis-mothers-flooring.trycloudflare.com';

async function testOllamaRAG() {
  console.log('🔌 Testing Ollama for RAG system...');
  console.log('URL:', OLLAMA_URL);

  // Test 1: Simple query
  console.log('\n📝 Test 1: Simple query');
  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: 'Viêm phổi ở trẻ em là gì? Trả lời ngắn gọn.',
        stream: false
      })
    });

    const data = await response.json();
    console.log('✅ Response:', data.response);
    console.log('⏱️  Time:', (data.total_duration / 1e9).toFixed(2), 'seconds');
    console.log('🚀 Speed:', (data.eval_count / (data.eval_duration / 1e9)).toFixed(1), 'tokens/s');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Test 2: RAG-style query with context
  console.log('\n📚 Test 2: RAG query with context');
  try {
    const context = `
Theo WHO, viêm phổi là nguyên nhân gây tử vong hàng đầu ở trẻ em dưới 5 tuổi.
X-quang ngực là phương tiện chẩn đoán phổ biến nhất.
Triệu chứng điển hình: sốt, ho, thở nhanh, khó thở.
    `.trim();

    const prompt = `Dựa trên thông tin sau:
${context}

Câu hỏi: Triệu chứng chính của viêm phổi ở trẻ em là gì?
Trả lời ngắn gọn dựa trên thông tin đã cho.`;

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5:7b',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,  // Lower for more factual responses
          top_p: 0.9
        }
      })
    });

    const data = await response.json();
    console.log('✅ Response:', data.response);
    console.log('⏱️  Time:', (data.total_duration / 1e9).toFixed(2), 'seconds');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Test 3: Check model availability
  console.log('\n📋 Test 3: Available models');
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    console.log('✅ Available models:');
    data.models.forEach(m => {
      console.log(`  - ${m.name} (${(m.size / 1e9).toFixed(2)} GB)`);
    });
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testOllamaRAG();
