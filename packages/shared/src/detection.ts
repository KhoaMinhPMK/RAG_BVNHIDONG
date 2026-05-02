import { z } from 'zod';

/**
 * Detection JSON schema từ AI model
 * Format: {image_id, detections: [{bbox, label, score}]}
 */

export const BoundingBoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const DetectionItemSchema = z.object({
  bbox: BoundingBoxSchema,
  label: z.string(), // 'consolidation', 'pleural_effusion', 'infiltrate', etc.
  score: z.number().min(0).max(1), // Confidence score 0-1
  metadata: z.record(z.unknown()).optional(), // Additional metadata
});

export const DetectionResultSchema = z.object({
  image_id: z.string(),
  detections: z.array(DetectionItemSchema),
  model_version: z.string().optional(),
  timestamp: z.string().datetime().optional(),
});

export type BoundingBox = z.infer<typeof BoundingBoxSchema>;
export type DetectionItem = z.infer<typeof DetectionItemSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
