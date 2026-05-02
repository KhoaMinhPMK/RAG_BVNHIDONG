/**
 * Auth Context Provider
 *
 * Provides authentication state and methods throughout the app.
 * Manages Supabase session, user profile, and role-based access.
 */

'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

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

// Supabase client - created once and reused
const supabase = createClient();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)  // ✅ Fixed: use user_id instead of id
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

  // Initialize auth state + listen for changes
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          console.log('[Auth] Found existing session:', session.user.email);
          setUser(session.user);
          setSession(session);
          const userProfile = await fetchProfile(session.user.id);
          if (mounted) setProfile(userProfile);
        }
      } catch (error) {
        console.error('[Auth] Error initializing auth:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('[Auth] State changed:', event, newSession?.user?.email);
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const userProfile = await fetchProfile(newSession.user.id);
          if (mounted) setProfile(userProfile);
        } else {
          if (mounted) setProfile(null);
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
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
      // Just wait a tick then return
      await new Promise(resolve => setTimeout(resolve, 300));

      return { error: null };
    } catch (error) {
      console.error('[Auth] Unexpected sign in error:', error);
      return { error: error as Error };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      console.log('[Auth] Signing out...');
      await supabase.auth.signOut();
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
    role: profile?.role || null,
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
