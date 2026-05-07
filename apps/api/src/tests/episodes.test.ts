import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    req.userRole = 'clinician';
    req.user = {
      sub: 'test-user-123',
      email: 'test@example.com',
      role: 'clinician',
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

const mockToken = 'test-token-456';

function mockEpisodeListQuery(result: { data: any[] | null; error: { message: string } | null; count: number }) {
  (supabase.from as any).mockImplementation((table: string) => {
    if (table !== 'episodes') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue(result),
        }),
      }),
    };
  });
}

function mockEpisodeInsert(data: Record<string, unknown>) {
  (supabase.from as any).mockImplementation((table: string) => {
    if (table !== 'episodes') {
      throw new Error(`Unexpected table: ${table}`);
    }

    return {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data,
            error: null,
          }),
        }),
      }),
    };
  });
}

function mockEpisodeDetailQueries(options: {
  episodeData: Record<string, unknown> | null;
  episodeError?: { message: string } | null;
  imagesData?: Array<Record<string, unknown>>;
  detectionData?: Record<string, unknown> | null;
}) {
  const {
    episodeData,
    episodeError = null,
    imagesData = [],
    detectionData = null,
  } = options;

  (supabase.from as any).mockImplementation((table: string) => {
    if (table === 'episodes') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: episodeData,
              error: episodeError,
            }),
          }),
        }),
      };
    }

    if (table === 'images') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: imagesData,
            error: null,
          }),
        }),
      };
    }

    if (table === 'detection_results') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: detectionData,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });
}

describe('Episodes API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/episodes', () => {
    it('should reject unauthorized request', async () => {
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
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return episodes list for authenticated user', async () => {
      mockEpisodeListQuery({
        data: [
          {
            id: 'ep-001',
            patient_ref: 'TEST-001',
            age: '5',
            gender: 'Nam',
            admission_date: '2026-05-02',
            status: 'pending_detection',
            findings: [],
            created_at: '2026-05-02T12:00:00Z',
            updated_at: '2026-05-02T12:00:00Z',
          },
        ],
        error: null,
        count: 1,
      });

      const response = await request(app)
        .get('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.episodes)).toBe(true);
      expect(response.body.total).toBe(1);
      expect(response.body.hasMore).toBe(false);
    });

    it('should handle database errors gracefully', async () => {
      mockEpisodeListQuery({
        data: null,
        error: { message: 'Database connection failed' },
        count: 0,
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
      mockEpisodeInsert({
        id: 'ep-new-001',
        patient_ref: 'TEST-002',
        age: '5',
        gender: 'Nam',
        admission_date: '2026-05-02',
        status: 'pending_detection',
        findings: [],
        created_by: 'test-user-123',
        created_at: '2026-05-02T12:00:00Z',
        updated_at: '2026-05-02T12:00:00Z',
      });

      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          patient_ref: 'TEST-002',
          age: '5',
          gender: 'Nam',
          admission_date: '2026-05-02',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.episode).toBeDefined();
      expect(response.body.episode.patient_ref).toBe('TEST-002');
    });

    it('should reject invalid episode data', async () => {
      const response = await request(app)
        .post('/api/episodes')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          patient_ref: '',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/episodes/:id', () => {
    it('should return episode detail', async () => {
      const episodeId = 'ep-001';

      mockEpisodeDetailQueries({
        episodeData: {
          id: episodeId,
          patient_ref: 'TEST-001',
          age: '5',
          gender: 'Nam',
          admission_date: '2026-05-02',
          status: 'pending_detection',
          findings: [],
          created_at: '2026-05-02T12:00:00Z',
          updated_at: '2026-05-02T12:00:00Z',
        },
        imagesData: [
          {
            image_id: 'img-001',
            file_name: 'cxr-001.png',
            storage_path: 'episodes/ep-001/cxr-001.png',
            uploaded_at: '2026-05-02T12:00:00Z',
          },
        ],
        detectionData: {
          status: 'completed',
          progress: 100,
          results: { detections: [] },
        },
      });

      const response = await request(app)
        .get(`/api/episodes/${episodeId}`)
        .set('Authorization', `Bearer ${mockToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.episode).toBeDefined();
      expect(response.body.episode.episode_id).toBe(episodeId);
      expect(response.body.images).toHaveLength(1);
      expect(response.body.detection_results.status).toBe('completed');
    });

    it('should return 404 for non-existent episode', async () => {
      mockEpisodeDetailQueries({
        episodeData: null,
        episodeError: { message: 'Not found' },
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