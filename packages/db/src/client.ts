import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client cho server-side operations
 * Sử dụng service role key để bypass RLS
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Supabase client cho client-side operations
 * Sử dụng anon key với RLS
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Type-safe database types
 * Generated from schema
 */
export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          id: string;
          title: string;
          version: string;
          source: 'WHO' | 'BTS' | 'BYT' | 'PubMed' | 'Internal' | 'Other';
          effective_date: string;
          expiry_date: string | null;
          owner: string;
          approved_by: string | null;
          age_group: string | null;
          status: 'draft' | 'active' | 'superseded' | 'retired';
          language: 'vi' | 'en';
          access_level: 'public' | 'clinician' | 'radiologist' | 'researcher' | 'admin';
          file_url: string | null;
          checksum: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['documents']['Insert']>;
      };
      chunks: {
        Row: {
          id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          embedding: number[] | null;
          metadata: Record<string, any> | null;
          effective_date: string;
          expiry_date: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['chunks']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['chunks']['Insert']>;
      };
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'clinician' | 'radiologist' | 'researcher' | 'admin';
          department: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['users']['Insert']>;
      };
      query_logs: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          agent: 'knowledge' | 'explainer' | 'reporter' | 'document-sourcing';
          query: string;
          retrieved_sources: Record<string, any> | null;
          output_text: string | null;
          citations: Record<string, any> | null;
          latency_ms: number | null;
          model_version: string | null;
          approved_by: string | null;
          approval_note: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['query_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['query_logs']['Insert']>;
      };
    };
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold?: number;
          match_count?: number;
          filter_document_ids?: string[] | null;
          filter_sources?: string[] | null;
          filter_access_levels?: string[] | null;
        };
        Returns: {
          chunk_id: string;
          document_id: string;
          content: string;
          similarity: number;
          metadata: Record<string, any> | null;
          document_title: string;
          document_version: string;
          document_source: string;
        }[];
      };
    };
  };
};
