/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
    signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUpWithEmail: (email: string, password: string, fullName?: string) => Promise<{ error: AuthError | null }>;
    sendMagicLink: (email: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    isConfigured: boolean; // Whether Supabase is set up
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signIn: async () => ({ error: null }),
    signInWithEmail: async () => ({ error: null }),
    signUpWithEmail: async () => ({ error: null }),
    sendMagicLink: async () => ({ error: null }),
    signOut: async () => { },
    isAuthenticated: false,
    isConfigured: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConfigured] = useState(() => isSupabaseConfigured());

    useEffect(() => {
        // If Supabase is not configured, just mark as not loading
        if (!isConfigured) {
            setLoading(false);
            return;
        }

        let mounted = true;
        let subscriptionCleanup: (() => void) | null = null;

        const initAuth = async () => {
            // CF Worker is always-on — no probing needed.
            const supabase = getSupabase();
            if (!supabase) {
                if (mounted) setLoading(false);
                return;
            }

            // E2E Test Bypass
            if (process.env.NODE_ENV !== 'production' &&
                typeof document !== 'undefined' &&
                document.cookie.includes('playwright-e2e=true')) {
                if (mounted) {
                    // Provide a fake session so routing works
                    setSession({} as Session);
                    setUser({ id: 'test-user', email: 'test@example.com' } as User);
                    setLoading(false);
                }
                return;
            }

            try {
                const { data } = await supabase.auth.getSession();
                if (mounted) {
                    setSession(data.session);
                    setUser(data.session?.user ?? null);
                    if (data.session) {
                        setLoading(false);
                    }
                }
            } catch (error) {
                console.error('Failed to get session:', error);
                if (mounted) {
                    setLoading(false);
                }
            }

            // Listen for auth changes if still mounted
            if (mounted) {
                const { data: { subscription } } = supabase.auth.onAuthStateChange(
                    (event: AuthChangeEvent, newSession: Session | null) => {
                        if (mounted) {
                            setSession(newSession);
                            setUser(newSession?.user ?? null);
                            setLoading(false);
                        }
                    }
                );
                subscriptionCleanup = () => subscription.unsubscribe();

                // Extra safeguard to set loading false if session check finishes.
                setLoading(false);
            }
        };

        initAuth();

        return () => {
            mounted = false;
            if (subscriptionCleanup) {
                subscriptionCleanup();
            }
        };
    }, [isConfigured]);

    const signIn = useCallback(async (provider: 'google' | 'github') => {
        if (!isConfigured) {
            return { error: { message: 'Supabase is not configured' } as AuthError };
        }

        const supabase = getSupabase();
        if (!supabase) {
            return { error: { message: 'Supabase client not available' } as AuthError };
        }

        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        return { error };
    }, [isConfigured]);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
        if (!isConfigured) return { error: { message: 'Supabase is not configured' } as AuthError };
        const supabase = getSupabase();
        if (!supabase) return { error: { message: 'Supabase client not available' } as AuthError };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    }, [isConfigured]);

    const signUpWithEmail = useCallback(async (email: string, password: string, fullName?: string) => {
        if (!isConfigured) return { error: { message: 'Supabase is not configured' } as AuthError };
        const supabase = getSupabase();
        if (!supabase) return { error: { message: 'Supabase client not available' } as AuthError };
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { full_name: fullName },
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        return { error };
    }, [isConfigured]);

    const sendMagicLink = useCallback(async (email: string) => {
        if (!isConfigured) return { error: { message: 'Supabase is not configured' } as AuthError };
        const supabase = getSupabase();
        if (!supabase) return { error: { message: 'Supabase client not available' } as AuthError };
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
                // Force token_hash flow so magic links work when opened in email
                // app in-app browsers (which don't share cookies from the main browser,
                // making PKCE verifier unavailable and causing auth to fail).
                shouldCreatePKCEVerifier: false,
            } as any,
        });
        return { error };
    }, [isConfigured]);

    const signOut = useCallback(async () => {
        if (!isConfigured) return;

        const supabase = getSupabase();
        if (!supabase) return;

        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    }, [isConfigured]);

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                signIn,
                signInWithEmail,
                signUpWithEmail,
                sendMagicLink,
                signOut,
                isAuthenticated: !!user,
                isConfigured,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
