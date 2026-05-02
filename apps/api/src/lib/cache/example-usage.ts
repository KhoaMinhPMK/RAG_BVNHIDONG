import express from 'express';
import { getOrSetCache, checkRedisHealth } from '../lib/cache/redis.js';
import { rateLimit, RateLimitPresets } from '../middleware/rate-limit.js';

/**
 * Example usage of Redis caching and rate limiting
 *
 * This file demonstrates how to use the Redis cache layer in your API routes.
 */

const router = express.Router();

// ============================================================================
// Example 1: Basic API Response Caching
// ============================================================================

router.get('/api/search', async (req, res) => {
  const query = req.query.q as string;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  try {
    // Cache search results for 5 minutes
    const results = await getOrSetCache(
      `search:${query}`,
      async () => {
        // Simulate expensive search operation
        console.log(`Performing search for: ${query}`);
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          query,
          results: [
            { id: 1, title: 'Result 1', score: 0.95 },
            { id: 2, title: 'Result 2', score: 0.87 },
          ],
          timestamp: new Date().toISOString(),
        };
      },
      300 // 5 minutes TTL
    );

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ============================================================================
// Example 2: Rate Limited Endpoint
// ============================================================================

// Apply standard rate limit (60 requests per minute)
router.post(
  '/api/generate',
  rateLimit(RateLimitPresets.standard),
  async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt required' });
    }

    try {
      // Simulate LLM generation
      const response = await generateText(prompt);
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: 'Generation failed' });
    }
  }
);

// ============================================================================
// Example 3: Strict Rate Limit for Expensive Operations
// ============================================================================

// Apply strict rate limit (10 requests per minute)
router.post(
  '/api/embed',
  rateLimit(RateLimitPresets.strict),
  async (req, res) => {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text required' });
    }

    try {
      // Cache embeddings by text hash
      const textHash = hashText(text);
      const embedding = await getOrSetCache(
        `embedding:${textHash}`,
        async () => {
          console.log('Generating embedding...');
          return await generateEmbedding(text);
        },
        3600 // 1 hour TTL
      );

      res.json({ embedding });
    } catch (error) {
      res.status(500).json({ error: 'Embedding failed' });
    }
  }
);

// ============================================================================
// Example 4: Document Caching
// ============================================================================

router.get('/api/documents/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const document = await getOrSetCache(
      `document:${id}`,
      async () => {
        console.log(`Fetching document ${id} from database...`);
        // Simulate database query
        return await fetchDocumentFromDB(id);
      },
      1800 // 30 minutes TTL
    );

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// ============================================================================
// Example 5: Health Check Endpoint
// ============================================================================

router.get('/health/redis', async (req, res) => {
  const health = await checkRedisHealth();

  const statusCode = health.status === 'healthy' ? 200 : 503;

  res.status(statusCode).json({
    service: 'redis',
    ...health,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Example 6: Custom Rate Limit
// ============================================================================

router.post(
  '/api/expensive-operation',
  rateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'This operation is rate limited to 5 requests per minute',
  }),
  async (req, res) => {
    try {
      // Expensive operation
      const result = await performExpensiveOperation();
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: 'Operation failed' });
    }
  }
);

// ============================================================================
// Helper Functions (Mock implementations)
// ============================================================================

async function generateText(prompt: string): Promise<string> {
  // Mock LLM generation
  await new Promise((resolve) => setTimeout(resolve, 500));
  return `Generated response for: ${prompt}`;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // Mock embedding generation
  await new Promise((resolve) => setTimeout(resolve, 200));
  return Array.from({ length: 768 }, () => Math.random());
}

function hashText(text: string): string {
  // Simple hash function (use crypto.createHash in production)
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

async function fetchDocumentFromDB(id: string): Promise<any> {
  // Mock database query
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    id,
    title: `Document ${id}`,
    content: 'Document content...',
    createdAt: new Date().toISOString(),
  };
}

async function performExpensiveOperation(): Promise<any> {
  // Mock expensive operation
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return { success: true, data: 'Operation completed' };
}

export default router;
