import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';

// Lazy-load Supabase client to ensure env vars are loaded first
let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (_supabase) {
    return _supabase;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase credentials in environment variables');
  }

  _supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return _supabase;
}

// Export getter instead of direct client
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});

// Test connection
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('documents').select('count').limit(1);

    if (error) {
      logger.error('Supabase connection test failed', { error: error.message });
      return false;
    }

    logger.info('✅ Supabase connection successful');
    return true;
  } catch (err) {
    logger.error('Supabase connection test error', { error: err });
    return false;
  }
}

// Database types (will be auto-generated later)
export interface Database {
  public: {
    Tables: {
      documents: {
        Row: {
          document_id: string;
          title: string;
          version: string;
          effective_date: string;
          status: 'active' | 'superseded' | 'retired';
          content: string;
          metadata: Record<string, any>;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      document_chunks: {
        Row: {
          chunk_id: string;
          document_id: string;
          content: string;
          embedding: number[];
          metadata: Record<string, any>;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['document_chunks']['Row'], 'created_at'>;
        Update: Partial<Database['public']['Tables']['document_chunks']['Insert']>;
      };
      episodes: {
        Row: {
          episode_id: string;
          patient_ref: string;
          age: string;
          gender: string;
          admission_date: string;
          chief_complaint: string;
          vital_signs: Record<string, any> | null;
          lab_results: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['episodes']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['episodes']['Insert']>;
      };
      draft_reports: {
        Row: {
          draft_id: string;
          episode_id: string;
          template_id: string;
          fields: any[];
          status: 'draft' | 'under_review' | 'edited' | 'approved' | 'rejected' | 'archived';
          model_version: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['draft_reports']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['draft_reports']['Insert']>;
      };
      audit_logs: {
        Row: {
          event_id: string;
          timestamp: string;
          user_id: string;
          user_role: string;
          action: string;
          episode_id: string | null;
          draft_id: string | null;
          details: Record<string, any> | null;
        };
        Insert: Database['public']['Tables']['audit_logs']['Row'];
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
    };
  };
}
