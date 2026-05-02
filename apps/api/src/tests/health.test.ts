import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Mock dependencies
vi.mock('../lib/supabase/client.js', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
  testSupabaseConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/ollama/client.js', () => ({
  ollamaClient: {
    testConnection: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../lib/ingestion/service.js', () => ({
  ingestionService: {
    ingestDocument: vi.fn(),
  },
}));

vi.mock('../middleware/auth.js', () => ({
  authenticateJWT: vi.fn((req, res, next) => next()),
}));

vi.mock('../middleware/rbac.js', () => ({
  requirePermission: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

// Import app after mocks
import app from '../index.js';

describe('Health Check API', () => {
  it('should return health status', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('services');
    expect(response.body.services).toHaveProperty('supabase');
    expect(response.body.services).toHaveProperty('ollama');
  });

  it('should return API info', async () => {
    const response = await request(app).get('/api');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('endpoints');
  });
});
