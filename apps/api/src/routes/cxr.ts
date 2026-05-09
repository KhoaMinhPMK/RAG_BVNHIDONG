/**
 * CXR (Chest X-Ray) Analysis Routes
 *
 * Proxies image inference requests to the FastAPI CXR service running on A100.
 * Results are stored in detection_results so the CAE agent can read them via
 * the existing get_detection_results tool.
 *
 * POST /api/cxr/analyze/:episode_id  — analyze uploaded X-ray for a patient episode
 * GET  /api/cxr/status/:episode_id   — get latest analysis result
 * GET  /api/cxr/health               — check CXR service reachability
 */

import { Router } from 'express';
import multer from 'multer';
import FormData from 'form-data';
import { authenticateJWT } from '../middleware/auth.js';
import { supabase } from '../lib/supabase/client.js';
import { logger } from '../lib/utils/logger.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Read lazily at request time (dotenvx injects env after module initialization)
function getCxrUrl(): string {
  return process.env.CXR_SERVICE_URL ?? '';
}

function requireService(res: import('express').Response): boolean {
  if (!getCxrUrl()) {
    logger.warn('[CXR] CXR_SERVICE_URL not set');
    res.status(503).json({ success: false, error: 'CXR_SERVICE_URL chưa được cấu hình.' });
    return false;
  }
  return true;
}

/**
 * GET /api/cxr/health
 * Kiểm tra CXR service có online không.
 */
router.get('/health', authenticateJWT, async (_req, res) => {
  if (!requireService(res)) return;
  try {
    const r = await fetch(`${getCxrUrl()}/health`, { signal: AbortSignal.timeout(8000) });
    const data = await r.json();
    res.json({ success: true, service: data });
  } catch (err) {
    res.status(502).json({ success: false, error: 'CXR service không phản hồi', detail: String(err) });
  }
});

/**
 * POST /api/cxr/analyze/:episode_id
 * Nhận ảnh X-quang (multipart), gửi lên CXR service, lưu kết quả vào detection_results.
 */
router.post('/analyze/:episode_id', authenticateJWT, upload.single('image'), async (req, res) => {
  if (!requireService(res)) return;

  const { episode_id } = req.params;

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Thiếu file ảnh (field name: image)' });
  }

  // Mark as processing
  await supabase.from('detection_results').upsert(
    { episode_id, status: 'processing', progress: 0, results: null, created_at: new Date().toISOString() },
    { onConflict: 'episode_id' }
  );

  logger.info('[CXR] Starting analysis', { episode_id, fileSize: req.file.size, mimeType: req.file.mimetype });

  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'xray.png',
      contentType: req.file.mimetype,
    });
    const formBuffer = form.getBuffer();

    const response = await fetch(`${getCxrUrl()}/analyze`, {
      method: 'POST',
      body: formBuffer,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${form.getBoundary()}`,
        'Content-Length': String(formBuffer.length),
      },
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`CXR service error ${response.status}: ${text}`);
    }

    const result = await response.json() as {
      predictions: Array<{ label: string; probability: number }>;
      heatmaps: Record<string, string>; // base64 JPEG
      top_finding: string;
    };

    // Persist to detection_results
    const { error: dbErr } = await supabase.from('detection_results').upsert(
      {
        episode_id,
        status: 'completed',
        progress: 100,
        results: {
          source: 'cxr-model-lambda0005',
          model: 'XRV-DenseNet121-bbox-aware',
          analyzed_at: new Date().toISOString(),
          predictions: result.predictions,
          top_finding: result.top_finding,
          heatmap_classes: Object.keys(result.heatmaps),
        },
      },
      { onConflict: 'episode_id' }
    );

    if (dbErr) logger.warn('[CXR] Failed to persist to detection_results', { error: dbErr.message });

    logger.info('[CXR] Analysis complete', { episode_id, top_finding: result.top_finding });

    // Return full result (including heatmaps) to frontend
    return res.json({
      success: true,
      episode_id,
      top_finding: result.top_finding,
      predictions: result.predictions,
      heatmaps: result.heatmaps,
    });

  } catch (err) {
    logger.error('[CXR] Analysis failed', { episode_id, error: String(err) });

    await supabase.from('detection_results').upsert(
      { episode_id, status: 'failed', progress: 0, results: { error: String(err) } },
      { onConflict: 'episode_id' }
    );

    return res.status(502).json({ success: false, error: 'Phân tích thất bại', detail: String(err) });
  }
});

/**
 * GET /api/cxr/status/:episode_id
 * Lấy kết quả phân tích mới nhất (không cần chạy lại).
 */
router.get('/status/:episode_id', authenticateJWT, async (req, res) => {
  const { episode_id } = req.params;

  const { data, error } = await supabase
    .from('detection_results')
    .select('status, progress, results, created_at')
    .eq('episode_id', episode_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ success: false, error: error.message });
  if (!data) return res.json({ success: true, status: 'none', results: null });

  return res.json({ success: true, ...data });
});

export default router;
