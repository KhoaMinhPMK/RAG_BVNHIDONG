/**
 * Auth Context Provider
 *
 * Provides authentication state and methods throughout the app.
 * Manages Supabase session, user profile, and role-based access.
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

// Role type matching backend RBAC
export type Role = 'clinician' | 'radiologist' | 'researcher' | 'admin';

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  department?: string;
  avatar_url?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// When NEXT_PUBLIC_SKIP_AUTH=true, bypass Supabase entirely (dev/demo mode).
// Set NEXT_PUBLIC_DEV_ROLE to control which role is simulated (default: 'admin').
const SKIP_AUTH = process.env.NEXT_PUBLIC_SKIP_AUTH === 'true';
const DEV_ROLE = (process.env.NEXT_PUBLIC_DEV_ROLE as Role | undefined) ?? 'admin';

// Lazy Supabase client — only instantiated when credentials are present.
// Avoids module-level crash when NEXT_PUBLIC_SUPABASE_* env vars are missing.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) _supabase = createClient();
  return _supabase;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(!SKIP_AUTH);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('[Auth] Error fetching profile:', error.message);
        return null;
      }

      if (!data) {
        console.error('[Auth] No profile data for user:', userId);
        return null;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('[Auth] Unexpected error fetching profile:', error);
      return null;
    }
  }, []);

  // Initialize auth state + listen for changes.
  // Skipped entirely in SKIP_AUTH mode.
  useEffect(() => {
    if (SKIP_AUTH) return;

    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await getSupabase().auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          console.log('[Auth] Found existing session:', session.user.email);
          setUser(session.user);
          setSession(session);
          // Profile loads in background — do not await here. A hung or slow
          // `profiles` query must not keep `loading` true or the shell never renders.
          void fetchProfile(session.user.id).then((userProfile) => {
            if (mounted) setProfile(userProfile);
          });
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = getSupabase().auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] State changed:', event, newSession?.user?.email);
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          void fetchProfile(newSession.user.id).then((userProfile) => {
            if (mounted) setProfile(userProfile);
          });
        } else {
          setProfile(null);
        }

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (SKIP_AUTH) return { error: null };

    try {
      const { data, error } = await getSupabase().auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] Sign in error:', error.message);
        return { error };
      }

      if (!data.user) {
        return { error: new Error('No user returned from sign in') };
      }

      // onAuthStateChange will handle setUser/setProfile
      await new Promise(resolve => setTimeout(resolve, 300));

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign in error:', error);
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (SKIP_AUTH) return;

    try {
      console.log('[Auth] Signing out...');
      await getSupabase().auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);

      // Force redirect to login and reload to clear all state
      window.location.href = '/login';
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    profile,
    role: SKIP_AUTH ? DEV_ROLE : (profile?.role ?? null),
    loading,
    signIn,
    signOut,
  }), [session, user, profile, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
