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
  authenticateJWT: vi.fn((req, res, next) => {
    // Mock authenticated user
    req.userId = 'test-user-123';
    req.userRole = 'doctor';
    req.user = {
      sub: 'test-user-123',
      email: 'test@example.com',
      role: 'doctor',
      aud: 'authenticated',
      exp: 0,
    };
    next();
  }),
}));

vi.mock('../middleware/rbac.js', () => ({
  requirePermission: vi.fn(() => (req: any, res: any, next: any) => next()),
}));

// Import app after mocks
import app from '../index.js';

describe('Episodes API - Basic Tests', () => {
  it('should have episodes endpoint available', async () => {
    const response = await request(app).get('/api');

    expect(response.status).toBe(200);
    expect(response.body.endpoints).toHaveProperty('episodes');
  });

  it('should require authentication for episodes list', async () => {
    // Temporarily override auth mock to reject
    const { authenticateJWT } = await import('../middleware/auth.js');
    (authenticateJWT as any).mockImplementationOnce((req: any, res: any) => {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing authorization header',
        },
      });
    });

    const response = await request(app).get('/api/episodes');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
