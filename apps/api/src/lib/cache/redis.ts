import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

/**
 * Redis client singleton
 * Supports both local Redis and Redis Cloud (Upstash, Redis Labs, etc.)
 */
class RedisClient {
  private static instance: Redis | null = null;
  private static isConnected: boolean = false;

  /**
   * Get Redis client instance
   */
  static getInstance(): Redis | null {
    if (!this.instance) {
      this.instance = this.createClient();
    }
    return this.instance;
  }

  /**
   * Create Redis client
   */
  private static createClient(): Redis | null {
    const redisUrl = process.env.REDIS_URL;

    // Redis is optional - app works without it
    if (!redisUrl) {
      logger.warn('REDIS_URL not configured - caching disabled');
      return null;
    }

    try {
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            return true;
          }
          return false;
        },
      });

      client.on('connect', () => {
        this.isConnected = true;
        logger.info('Redis connected successfully');
      });

      client.on('error', (err: Error) => {
        this.isConnected = false;
        logger.error('Redis connection error:', err);
      });

      client.on('close', () => {
        this.isConnected = false;
        logger.warn('Redis connection closed');
      });

      return client;
    } catch (error) {
      logger.error('Failed to create Redis client:', error);
      return null;
    }
  }

  /**
   * Check if Redis is connected
   */
  static isReady(): boolean {
    return this.isConnected && this.instance !== null;
  }

  /**
   * Close Redis connection
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.quit();
      this.instance = null;
      this.isConnected = false;
      logger.info('Redis connection closed');
    }
  }
}

/**
 * Get or set cache with TTL
 * Falls back to fetchFn if Redis is unavailable
 */
export async function getOrSetCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = 300 // 5 minutes default
): Promise<T> {
  const redis = RedisClient.getInstance();

  // If Redis not available, just fetch
  if (!redis || !RedisClient.isReady()) {
    return await fetchFn();
  }

  try {
    // Try to get from cache
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(cached) as T;
    }

    logger.debug(`Cache MISS: ${key}`);

    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache (fire and forget)
    redis.set(key, JSON.stringify(data), 'EX', ttl).catch((err) => {
      logger.error(`Failed to set cache for ${key}:`, err);
    });

    return data;
  } catch (error) {
    logger.error(`Cache error for ${key}:`, error);
    // Fallback to fetch on error
    return await fetchFn();
  }
}

/**
 * Invalidate cache by key or pattern
 */
export async function invalidateCache(keyOrPattern: string): Promise<void> {
  const redis = RedisClient.getInstance();

  if (!redis || !RedisClient.isReady()) {
    return;
  }

  try {
    if (keyOrPattern.includes('*')) {
      // Pattern - delete multiple keys
      const keys = await redis.keys(keyOrPattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Invalidated ${keys.length} cache keys matching: ${keyOrPattern}`);
      }
    } else {
      // Single key
      await redis.del(keyOrPattern);
      logger.debug(`Invalidated cache: ${keyOrPattern}`);
    }
  } catch (error) {
    logger.error(`Failed to invalidate cache ${keyOrPattern}:`, error);
  }
}

/**
 * Set cache value with TTL
 */
export async function setCache(
  key: string,
  value: any,
  ttl: number = 300
): Promise<void> {
  const redis = RedisClient.getInstance();

  if (!redis || !RedisClient.isReady()) {
    return;
  }

  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttl);
    logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    logger.error(`Failed to set cache ${key}:`, error);
  }
}

/**
 * Get cache value
 */
export async function getCache<T>(key: string): Promise<T | null> {
  const redis = RedisClient.getInstance();

  if (!redis || !RedisClient.isReady()) {
    return null;
  }

  try {
    const cached = await redis.get(key);
    if (cached) {
      logger.debug(`Cache GET: ${key}`);
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get cache ${key}:`, error);
    return null;
  }
}

/**
 * Increment counter (for rate limiting)
 */
export async function incrementCounter(
  key: string,
  ttl: number = 60
): Promise<number> {
  const redis = RedisClient.getInstance();

  if (!redis || !RedisClient.isReady()) {
    return 0;
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      // First increment - set TTL
      await redis.expire(key, ttl);
    }
    return count;
  } catch (error) {
    logger.error(`Failed to increment counter ${key}:`, error);
    return 0;
  }
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'unhealthy' | 'disabled';
  latency?: number;
  error?: string;
}> {
  const redis = RedisClient.getInstance();

  if (!redis) {
    return { status: 'disabled' };
  }

  if (!RedisClient.isReady()) {
    return { status: 'unhealthy', error: 'Not connected' };
  }

  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;

    return { status: 'healthy', latency };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export Redis client for advanced usage
export { RedisClient };

// Graceful shutdown
process.on('SIGTERM', async () => {
  await RedisClient.close();
});

process.on('SIGINT', async () => {
  await RedisClient.close();
});
