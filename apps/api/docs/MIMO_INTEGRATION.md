# MiMo API Integration

## Overview

MiMo API integration cho phép sử dụng các mô hình LLM từ xiaomimomo.com như một alternative/fallback cho Ollama local models.

## Features

- ✅ OpenAI-compatible API interface
- ✅ Multi-model support (V2.5-Pro, V2.5, V2-Omni, TTS)
- ✅ Racing strategy (Ollama vs MiMo - fastest wins)
- ✅ Automatic fallback
- ✅ Credit usage tracking
- ✅ Off-peak optimization (23:00-07:00 VN = 0.8x credits)

## Setup

### 1. Environment Variables

Add to `apps/api/.env`:

```env
# MiMo API
MIMO_API_KEY=tp-your-actual-api-key-here
MIMO_BASE_URL=https://token-plan-sgp.xiaomimomo.com/v1
MIMO_MODEL_PRIMARY=MiMo-V2.5-Pro
MIMO_MODEL_FALLBACK=MiMo-V2.5
MIMO_MODEL_OMNI=MiMo-V2-Omni
MIMO_MODEL_TTS=MiMo-V2.5-TTS
```

### 2. Test Connection

```bash
cd apps/api
npx tsx src/scripts/test-mimo-simple.ts
```

Expected output:
```
✅ Models endpoint works!
✅ Chat endpoint works!
```

## Usage

### Basic Chat

```typescript
import { getMiMoClient } from '@/lib/mimo';

const client = getMiMoClient();

const response = await client.chat([
  { role: 'system', content: 'You are a medical AI assistant.' },
  { role: 'user', content: 'What is pneumonia?' },
], {
  temperature: 0.7,
  max_tokens: 2000,
});

console.log(response.choices[0].message.content);
```

### LLM Racing (Ollama vs MiMo)

```typescript
import { getLLMRacer } from '@/lib/llm';

const racer = getLLMRacer();

const result = await racer.race(
  'What are the symptoms of TB?',
  'Context: Tuberculosis is...',
  {
    timeout: 30000,
    preferOllama: false, // false = fastest wins, true = prefer Ollama
    storeComparison: true, // Store both responses for quality comparison
  }
);

console.log('Winner:', result.winner); // 'ollama' or 'mimo'
console.log('Response:', result.response);
console.log('Ollama time:', result.ollamaTime, 'ms');
console.log('MiMo time:', result.mimoTime, 'ms');
```

### Image Analysis (MiMo-V2-Omni)

```typescript
import { getMiMoClient } from '@/lib/mimo';
import fs from 'fs';

const client = getMiMoClient();
const imageBuffer = fs.readFileSync('xray.jpg');

const result = await client.analyzeImage(
  imageBuffer,
  'Analyze this chest X-ray and describe findings.'
);

console.log('Description:', result.description);
console.log('Findings:', result.findings);
```

### Text-to-Speech

```typescript
import { getMiMoClient } from '@/lib/mimo';
import fs from 'fs';

const client = getMiMoClient();

const result = await client.textToSpeech(
  'Patient has pneumonia in the right lower lobe.',
  'default'
);

fs.writeFileSync('output.mp3', result.audio);
```

## Architecture

```
User Request
    ↓
Knowledge Agent / Detection Agent
    ↓
LLMRacer.race()
    ↓
    ├─→ Ollama (qwen2.5:7b) ──┐
    │                          ├─→ First response wins
    └─→ MiMo (V2.5-Pro) ──────┘
    ↓
Response to User
```

## Credit Usage

### Estimated Credits per Operation

| Operation | Model | Credits | Daily (100x) | Monthly |
|-----------|-------|---------|--------------|---------|
| RAG Query | V2.5-Pro | ~500 | 50K | 1.5M |
| Explain | V2.5-Pro | ~800 | 80K | 2.4M |
| Draft Report | V2.5-Pro | ~1,200 | 120K | 3.6M |
| Image Analysis | V2-Omni | ~2,000 | 200K | 6M |
| TTS | V2.5-TTS | ~300 | 30K | 900K |

**Total:** ~53M credits/month (700M credits = ~13 months)

### Off-Peak Hours (0.8x credits)

- **UTC:** 16:00-24:00
- **VN:** 23:00-07:00 (next day)

Schedule batch operations during off-peak for 20% savings.

## API Endpoints

### Health Check

```typescript
const isHealthy = await client.healthCheck();
```

### Models List

```bash
curl https://token-plan-sgp.xiaomimomo.com/v1/models \
  -H "Authorization: Bearer $MIMO_API_KEY"
```

### Chat Completion

```bash
curl https://token-plan-sgp.xiaomimomo.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MIMO_API_KEY" \
  -d '{
    "model": "MiMo-V2.5-Pro",
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "max_tokens": 100
  }'
```

## Error Handling

```typescript
try {
  const result = await racer.race(query, context);
  console.log(result.response);
} catch (error) {
  if (error.message.includes('Both LLMs failed')) {
    // Both Ollama and MiMo failed
    console.error('All LLMs unavailable');
  } else if (error.message.includes('timeout')) {
    // Timeout
    console.error('Request timeout');
  } else {
    // Other errors
    console.error('LLM error:', error);
  }
}
```

## Monitoring

### Log Output

```
[LLMRacer] Race completed: {
  winner: 'mimo',
  ollamaTime: 5234,
  mimoTime: 1823,
  ollamaSuccess: true,
  mimoSuccess: true
}
```

### Metrics to Track

- Response times (Ollama vs MiMo)
- Success rates
- Credit usage
- Winner distribution
- Error rates

## Troubleshooting

### "fetch failed"

- Check network connectivity
- Verify API key is correct (not masked)
- Check firewall/proxy settings

### "MiMo API error: 401"

- API key invalid or expired
- Check MIMO_API_KEY in .env

### "MiMo API error: 429"

- Rate limit exceeded
- Wait and retry
- Implement exponential backoff

### "Both LLMs failed"

- Check Ollama server status
- Check MiMo API status
- Verify network connectivity

## Next Steps

1. ✅ Basic integration complete
2. ⏳ Get real API key from user
3. ⏳ Test with real API calls
4. ⏳ Integrate with Knowledge Agent
5. ⏳ Add credit usage monitoring
6. ⏳ Setup off-peak scheduling

## Files Created

```
apps/api/src/lib/mimo/
  ├── client.ts          # MiMo API client
  └── index.ts           # Exports

apps/api/src/lib/llm/
  ├── racing.ts          # LLM racing strategy
  └── index.ts           # Exports

apps/api/src/scripts/
  ├── test-mimo.ts       # Full test suite
  └── test-mimo-simple.ts # Simple API test
```

## Status

**Phase 1: Basic Integration** ✅ COMPLETE (1 giờ)

- ✅ MiMoClient created
- ✅ LLMRacer created
- ✅ OllamaClient updated
- ✅ Test scripts created
- ✅ Documentation written
- ⏳ Waiting for real API key to test

**Next:** Phase 2 - Advanced Features (TTS, Image Analysis, Batch Processing)
