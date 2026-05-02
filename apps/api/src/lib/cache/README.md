# Redis Cache Setup

Redis caching layer cho WebRAG API.

## 🎯 Features

- **API Response Caching** - Cache expensive operations
- **Rate Limiting** - Protect against abuse
- **Session Storage** - User sessions (future)
- **Vector Search Cache** - Cache embedding results
- **Graceful Degradation** - App works without Redis

## 📦 Installation

### Option 1: Local Redis (Development)

```bash
# Install Redis
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# Start Redis
redis-server

# Test connection
redis-cli ping
# Should return: PONG
```

### Option 2: Redis Cloud (Production)

**Recommended providers:**
- **Upstash** - Serverless Redis (free tier available)
- **Redis Cloud** - Managed Redis
- **Railway** - Redis addon

**Upstash Setup:**
1. Go to https://upstash.com
2. Create account
3. Create Redis database
4. Copy connection URL

## ⚙️ Configuration

Add to `.env`:

```bash
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Or for Redis Cloud (Upstash example)
# REDIS_URL=rediss://default:xxxxx@xxxxx.upstash.io:6379
```

**Note:** Redis is optional. If `REDIS_URL` is not set, caching is disabled and app continues to work.

## 🚀 Usage

### 1. Basic Caching

```typescript
import { getOrSetCache } from './lib/cache/redis.js';

// Cache expensive operation
const data = await getOrSetCache(
  'cache-key',
  async () => {
    // Expensive operation
    return await fetchDataFromDatabase();
  },
  300 // TTL in seconds (5 minutes)
);
```

### 2. Rate Limiting

```typescript
import { rateLimit, RateLimitPresets } from './middleware/rate-limit.js';

// Apply to routes
app.use('/api/search', rateLimit(RateLimitPresets.standard));
app.use('/api/auth', rateLimit(RateLimitPresets.auth));

// Custom rate limit
app.use('/api/expensive', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Too many requests'
}));
```

### 3. Cache Invalidation

```typescript
import { invalidateCache } from './lib/cache/redis.js';

// Invalidate single key
await invalidateCache('user:123:profile');

// Invalidate pattern
await invalidateCache('user:123:*');
```

### 4. Manual Cache Operations

```typescript
import { setCache, getCache } from './lib/cache/redis.js';

// Set cache
await setCache('key', { data: 'value' }, 300);

// Get cache
const data = await getCache<MyType>('key');
```

## 📊 Cache Strategies

### API Response Caching

```typescript
// Cache search results
app.get('/api/search', async (req, res) => {
  const query = req.query.q as string;
  const cacheKey = `search:${query}`;

  const results = await getOrSetCache(
    cacheKey,
    async () => {
      return await performSearch(query);
    },
    300 // 5 minutes
  );

  res.json(results);
});
```

### Vector Search Caching

```typescript
// Cache embedding results
const embedding = await getOrSetCache(
  `embedding:${hash(text)}`,
  async () => {
    return await generateEmbedding(text);
  },
  3600 // 1 hour
);
```

### Document Caching

```typescript
// Cache document chunks
const chunks = await getOrSetCache(
  `document:${documentId}:chunks`,
  async () => {
    return await fetchDocumentChunks(documentId);
  },
  1800 // 30 minutes
);
```

## 🎯 Rate Limit Presets

| Preset | Window | Max Requests | Use Case |
|--------|--------|--------------|----------|
| `strict` | 1 min | 10 | Expensive operations (embeddings, LLM) |
| `standard` | 1 min | 60 | Normal API endpoints |
| `generous` | 1 min | 120 | Read-only endpoints |
| `auth` | 15 min | 5 | Authentication endpoints |

## 🔧 Advanced Usage

### Custom Key Generator

```typescript
import { rateLimit, userKeyGenerator } from './middleware/rate-limit.js';

// Rate limit by user ID
app.use('/api/user', rateLimit({
  ...RateLimitPresets.standard,
  keyGenerator: userKeyGenerator
}));
```

### Counter Operations

```typescript
import { incrementCounter } from './lib/cache/redis.js';

// Track API usage
const count = await incrementCounter('api:usage:user:123', 86400); // 24h TTL
```

## 🏥 Health Check

```typescript
import { checkRedisHealth } from './lib/cache/redis.js';

app.get('/health/redis', async (req, res) => {
  const health = await checkRedisHealth();
  res.json(health);
});

// Response:
// { status: 'healthy', latency: 5 }
// { status: 'unhealthy', error: 'Connection refused' }
// { status: 'disabled' }
```

## 📈 Monitoring

### Cache Hit Rate

```typescript
// Add logging to track cache performance
import { logger } from './utils/logger.js';

// In getOrSetCache function:
// Cache HIT: search:medical-term (logged)
// Cache MISS: search:new-query (logged)
```

### Redis Metrics

```bash
# Connect to Redis CLI
redis-cli

# Check memory usage
INFO memory

# Check hit rate
INFO stats

# Monitor commands in real-time
MONITOR
```

## 🚨 Error Handling

Redis errors are handled gracefully:

- **Connection failed** → Caching disabled, app continues
- **Timeout** → Falls back to fetching fresh data
- **Rate limit unavailable** → Allows requests (fail open)

## 🔒 Security

### Redis Authentication

```bash
# In production, use password
REDIS_URL=redis://:password@host:6379

# Or TLS
REDIS_URL=rediss://:password@host:6379
```

### Rate Limit Headers

Responses include rate limit info:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1683123456789
```

## 📝 Best Practices

1. **Set appropriate TTLs**
   - Short TTL (5-10 min) for frequently changing data
   - Long TTL (1-24 hours) for static data

2. **Use cache keys wisely**
   - Include version in key: `v1:user:123`
   - Use namespaces: `search:`, `user:`, `doc:`

3. **Invalidate on updates**
   - Clear cache when data changes
   - Use patterns for bulk invalidation

4. **Monitor cache hit rate**
   - Aim for >70% hit rate
   - Adjust TTLs based on metrics

5. **Handle Redis failures**
   - Always have fallback logic
   - Log errors for monitoring

## 🧪 Testing

```typescript
// Test with Redis
REDIS_URL=redis://localhost:6379 npm run dev

// Test without Redis (caching disabled)
npm run dev
```

## 📊 Performance Impact

**Expected improvements with Redis:**
- API response time: -50% (cached responses)
- Database load: -60% (fewer queries)
- Rate limit protection: 100% (prevents abuse)

## 🔄 Migration

To enable Redis in existing deployment:

1. Add Redis instance (Upstash/Railway)
2. Set `REDIS_URL` environment variable
3. Deploy - no code changes needed
4. Monitor cache hit rate
5. Adjust TTLs based on usage

---

**Status:** ✅ Ready to use  
**Dependencies:** `ioredis` (add to package.json)  
**Optional:** Redis is optional - app works without it
