import { z } from 'zod';

/**
 * Agent schemas
 */

export const AgentTypeSchema = z.enum(['knowledge', 'explainer', 'reporter', 'document-sourcing']);

export const AgentRequestSchema = z.object({
  agentType: AgentTypeSchema,
  input: z.record(z.unknown()),
  userId: z.string().uuid(),
  sessionId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const AgentResponseSchema = z.object({
  agentType: AgentTypeSchema,
  output: z.record(z.unknown()),
  citations: z.array(z.unknown()).optional(),
  metadata: z.object({
    model: z.string(),
    latency: z.number().int(),
    tokensUsed: z.number().int().optional(),
  }),
  warnings: z.array(z.string()).optional(),
  errors: z.array(z.string()).optional(),
});

export type AgentType = z.infer<typeof AgentTypeSchema>;
export type AgentRequest = z.infer<typeof AgentRequestSchema>;
export type AgentResponse = z.infer<typeof AgentResponseSchema>;
