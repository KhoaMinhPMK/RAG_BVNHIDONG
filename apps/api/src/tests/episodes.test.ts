import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock all dependencies BEFORE importing app
vi.mock('../lib/supabase/client.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
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

// Import app AFTER mocks
import app from '../index.js';
import { supabase } from '../lib/supabase/client.js';

describe('Episodes API', () => {
  const mockUserId = 'test-user-123';
  const mockToken = 'test-token-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/episodes', () => {
    it('should reject unauthorized request', async () => {
      const response = await request(app).get('/api/episodes');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return episodes list for authenticated user', async () => {
      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      // Mock profile fetch
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                user_id: mockUserId,
                email: 'test@example.com',
                role: 'doctor',
              },
              error: null,
            }),
          }),
        }),
      });
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return mockFrom(table);
        }
        // Mock episodes query
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: 'ep-001',
                      patient_ref: 'TEST-001',
                      age: '5',
                      gender: 'Nam',
                      status: 'pending_detection',
                      created_at: '2026-05-02T12:00:00Z',
                      updated_at: '2026-05-02T12:00:00Z',
                    },
                  ],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        };
      });

      const response = await request(app)
        .get('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.episodes)).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      // Mock profile fetch
      const mockFrom = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                user_id: mockUserId,
                email: 'test@example.com',
                role: 'doctor',
              },
              error: null,
            }),
          }),
        }),
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return mockFrom(table);
        }
        // Mock database error
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({
                then: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                  count: 0,
                }),
              }),
            }),
          }),
        };
      });

      const response = await request(app)
        .get('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('POST /api/episodes', () => {
    it('should create episode with valid data', async () => {
      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      // Mock profile and episode creation
      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    email: 'test@example.com',
                    role: 'doctor',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Mock episode insert
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'ep-new-001',
                  patient_ref: 'TEST-002',
                  age: '5',
                  gender: 'Nam',
                  status: 'pending_detection',
                  created_by: mockUserId,
                  created_at: '2026-05-02T12:00:00Z',
                  updated_at: '2026-05-02T12:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        };
      });

      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          patient_ref: 'TEST-002',
          age: '5',
          gender: 'Nam',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.episode).toBeDefined();
      expect(response.body.episode.patient_ref).toBe('TEST-002');
    });

    it('should reject invalid episode data', async () => {
      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    email: 'test@example.com',
                    role: 'doctor',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          // Missing required fields
          patient_ref: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/episodes/:id', () => {
    it('should return episode detail', async () => {
      const episodeId = 'ep-001';

      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    email: 'test@example.com',
                    role: 'doctor',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Mock episode detail
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: episodeId,
                  patient_ref: 'TEST-001',
                  age: '5',
                  gender: 'Nam',
                  status: 'pending_detection',
                  created_at: '2026-05-02T12:00:00Z',
                  updated_at: '2026-05-02T12:00:00Z',
                },
                error: null,
              }),
            }),
          }),
        };
      });

      const response = await request(app)
        .get(`/api/episodes/${episodeId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.episode).toBeDefined();
      expect(response.body.episode.episode_id).toBe(episodeId);
    });

    it('should return 404 for non-existent episode', async () => {
      // Mock authentication
      (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: { id: mockUserId, email: 'test@example.com' } },
        error: null,
      });

      (supabase.from as any).mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    user_id: mockUserId,
                    email: 'test@example.com',
                    role: 'doctor',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        // Mock not found
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        };
      });

      const response = await request(app)
        .get('/api/episodes/non-existent-id')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });
  });
});
