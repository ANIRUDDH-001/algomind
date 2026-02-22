'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
    isAuthenticated: boolean;
    isConfigured: boolean; // Whether Supabase is set up
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signIn: async () => ({ error: null }),
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

        const supabase = getSupabase();
        if (!supabase) {
            setLoading(false);
            return;
        }

        let mounted = true;

        // Get initial session
        const initSession = async () => {
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
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to get session:', error);
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event: AuthChangeEvent, newSession: Session | null) => {
                if (mounted) {
                    setSession(newSession);
                    setUser(newSession?.user ?? null);
                    setLoading(false);
                }
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
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
