// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

// Debug: Log env vars to verify they're loaded
console.log('DEBUG: OLLAMA_URL =', process.env.OLLAMA_URL);
console.log('DEBUG: OLLAMA_MODEL =', process.env.OLLAMA_MODEL);

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './lib/utils/logger.js';
import { auditMiddleware } from './middleware/audit.js';
import { testSupabaseConnection } from './lib/supabase/client.js';
// DON'T import ollamaClient here - import it lazily when needed

// Import routes
import queryRoutes from './routes/query.js';
import explainRoutes from './routes/explain.js';
import draftRoutes from './routes/draft.js';
import episodesRoutes from './routes/episodes.js';
import uploadRoutes from './routes/upload.js';
import detectRoutes from './routes/detect.js';
import documentsRoutes from './routes/documents.js';
import caeRoutes from './routes/cae.js';
import aiRunsRoutes from './routes/ai-runs.js';

const app: Express = express();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// ============================================================================
// Middleware
// ============================================================================

app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Audit logging middleware
app.use(auditMiddleware());

// ============================================================================
// Health Check  (cached 30s to avoid hammering Ollama/MiMo on every page load)
// ============================================================================

let healthCache: { data: unknown; ts: number } | null = null;
const HEALTH_CACHE_TTL = 30_000; // 30 seconds

app.get('/health', async (req: Request, res: Response) => {
  if (healthCache && Date.now() - healthCache.ts < HEALTH_CACHE_TTL) {
    return res.json(healthCache.data);
  }
  const supabaseOk = await testSupabaseConnection();

  let ollamaOk = false;
  let ollamaModel = '';
  let embeddingOk = false;
  let embeddingModel = '';
  let embeddingDim = 0;
  let mimoOk = false;
  let mimoModel = '';
  let caeStatus: 'ready' | 'degraded' | 'disconnected' = 'disconnected';
  let caeProvider = '';
  let caeModel = '';

  try {
    const { ollamaClient } = await import('./lib/ollama/client.js');
    ollamaOk = await ollamaClient.testConnection();
    ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:7b';
  } catch (error) {
    logger.error('Ollama health check failed', { error });
  }
  try {
    const { embeddingClient } = await import('./lib/embedding/client.js');
    embeddingOk = await embeddingClient.testConnection();
    embeddingDim = await embeddingClient.getEmbeddingDimension();
    embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
  } catch (error) {
    logger.error('Embedding health check failed', { error });
  }
  try {
    const { testLLMProvider } = await import('./lib/llm/unified.js');
    const mimoResult = await Promise.race([
      testLLMProvider('mimo'),
      new Promise<{ ok: false; model: string; error: string }>((resolve) =>
        setTimeout(() => resolve({ ok: false, model: '', error: 'timeout' }), 5000)
      ),
    ]);
    mimoOk = mimoResult.ok;
    mimoModel = mimoResult.model;
  } catch (error) {
    logger.error('MiMo health check failed', { error });
  }

  if (supabaseOk && embeddingOk && (mimoOk || ollamaOk)) {
    caeStatus = mimoOk ? 'ready' : 'degraded';
    caeProvider = mimoOk ? 'MiMo' : 'Ollama';
    caeModel = mimoOk ? mimoModel : ollamaModel;
  }

  const payload = {
    success: true,
    status: supabaseOk && (ollamaOk || mimoOk) && embeddingOk ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      supabase:  { status: supabaseOk ? 'connected' : 'disconnected' },
      cae:       { status: caeStatus, provider: caeProvider, model: caeModel },
      ollama:    { status: ollamaOk ? 'connected' : 'disconnected', model: ollamaModel },
      mimo:      { status: mimoOk ? 'connected' : 'disconnected',   model: mimoModel },
      embedding: { status: embeddingOk ? 'connected' : 'disconnected', model: embeddingModel, dim: embeddingDim },
    },
  };
  healthCache = { data: payload, ts: Date.now() };
  res.json(payload);
});

// ============================================================================
// API Routes
// ============================================================================

app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'WebRAG API Server',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      query: 'POST /api/query',
      explain: 'POST /api/explain',
      draft: 'POST /api/draft',
      caeBrief: 'POST /api/cae/brief',
      caeChat: 'POST /api/cae/chat',
      caeExplain: 'POST /api/cae/explain',
      caeDraft: 'POST /api/cae/draft',
      caeTts: 'POST /api/cae/tts',
      episodes: 'GET /api/episodes',
      episodeDetail: 'GET /api/episodes/:id',
      createEpisode: 'POST /api/episodes',
      updateEpisode: 'PATCH /api/episodes/:id',
      upload: 'POST /api/episodes/upload',
      triggerDetection: 'POST /api/detect',
      detectionStatus: 'GET /api/detect/:id',
      documents: 'GET /api/documents',
      documentDetail: 'GET /api/documents/:id',
      deleteDocument: 'DELETE /api/documents/:id',
      reingestDocument: 'POST /api/documents/:id/reingest',
    },
  });
});

// Mount route handlers
app.use('/api', queryRoutes);
app.use('/api', explainRoutes);
app.use('/api', draftRoutes);
app.use('/api', episodesRoutes);
app.use('/api', uploadRoutes);
app.use('/api', detectRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/cae', caeRoutes);
app.use('/api/ai-runs', aiRunsRoutes);
app.use('/api/drafts', aiRunsRoutes);  // draft approval sub-routes

// ============================================================================
// Error Handler
// ============================================================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
  });
});

// ============================================================================
// Start Server
// ============================================================================

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    logger.info(`🚀 API Server running on http://localhost:${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 CORS origin: ${CORS_ORIGIN}`);

    // Test connections on startup
    logger.info('Testing connections...');
    const supabaseOk = await testSupabaseConnection();

    // Lazy import ollamaClient AFTER env vars are loaded
    const { ollamaClient } = await import('./lib/ollama/client.js');
    const ollamaOk = await ollamaClient.testConnection();

    if (!supabaseOk) {
      logger.warn('⚠️  Supabase connection failed - some features may not work');
    }

    if (!ollamaOk) {
      logger.warn('⚠️  Ollama connection failed - AI features will not work');
    }

    if (supabaseOk && ollamaOk) {
      logger.info('✅ All services connected successfully');
    }
  });
}

export default app;
