// Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
dotenv.config();

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
const PORT = process.env.PORT || 3005;
const CORS_ORIGIN_RAW = process.env.CORS_ORIGIN || 'http://localhost:3001';
const CORS_ORIGINS = CORS_ORIGIN_RAW.split(',').map((s) => s.trim()).filter(Boolean);

// ============================================================================
// Middleware
// ============================================================================

app.use(helmet());
app.use(
  cors({
    origin: CORS_ORIGINS.length === 0 ? true : CORS_ORIGINS.length === 1 ? CORS_ORIGINS[0] : CORS_ORIGINS,
    credentials: true,
  })
);
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

async function handleHealth(_req: Request, res: Response): Promise<void> {
  if (healthCache && Date.now() - healthCache.ts < HEALTH_CACHE_TTL) {
    res.json(healthCache.data);
    return;
  }
  const supabaseOk = await testSupabaseConnection();

  let ollamaOk = false;
  let ollamaModel = '';
  let embeddingOk = false;
  let embeddingModel = '';
  let embeddingDim = 0;
  let mimoOk = false;
  let mimoModel = '';
  let mimoDetail: string | undefined;
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
  if (!process.env.MIMO_API_KEY?.trim()) {
    mimoDetail = 'Chưa cấu hình MIMO_API_KEY trong apps/api/.env';
  } else {
    try {
      const { testLLMProvider } = await import('./lib/llm/unified.js');
      // Allow longer than embedding/Ollama; MiMo ping uses /models (up to 12s) + optional chat fallback.
      const mimoResult = await Promise.race([
        testLLMProvider('mimo'),
        new Promise<{ ok: false; model: string; error: string }>((resolve) =>
          setTimeout(() => resolve({ ok: false, model: '', error: 'timeout' }), 25_000)
        ),
      ]);
      mimoOk = mimoResult.ok;
      mimoModel = mimoResult.model;
      if (!mimoOk && 'error' in mimoResult && mimoResult.error) {
        mimoDetail = mimoResult.error;
      }
    } catch (error) {
      logger.error('MiMo health check failed', { error });
      mimoDetail = error instanceof Error ? error.message : 'health check failed';
    }
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
      mimo:      {
        status: mimoOk ? 'connected' : 'disconnected',
        model: mimoModel,
        ...(mimoDetail ? { detail: mimoDetail } : {}),
      },
      embedding: { status: embeddingOk ? 'connected' : 'disconnected', model: embeddingModel, dim: embeddingDim },
    },
  };
  healthCache = { data: payload, ts: Date.now() };
  res.json(payload);
}

/** `/health` local; `/api/health` trên Vercel (serverless chỉ nhận path dưới `/api/*`). */
app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

// ============================================================================
// API Routes
// ============================================================================

app.get('/api', (req: Request, res: Response) => {
  res.json({
    message: 'WebRAG API Server',
    version: '0.1.0',
    endpoints: {
      health: 'GET /api/health (hoặc GET /health khi chạy API độc lập)',
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
      documentSourcePdf: 'GET /api/documents/:id/source',
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

// Không listen khi: Vercel serverless, test, hoặc app được nhúng trong Next (`NEXT_RUNTIME`).
const shouldListen =
  process.env.VERCEL !== '1' &&
  process.env.NODE_ENV !== 'test' &&
  process.env.NEXT_RUNTIME === undefined;

if (shouldListen) {
  app.listen(PORT, async () => {
    logger.info(`🚀 API Server running on http://localhost:${PORT}`);
    logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`🔗 CORS origins: ${CORS_ORIGIN_RAW}`);

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
