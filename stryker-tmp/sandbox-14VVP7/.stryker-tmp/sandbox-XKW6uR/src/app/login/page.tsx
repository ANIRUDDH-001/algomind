/**
 * @codesage
 * @file      src/app/login/page.tsx
 * @purpose   Client component for the login page, handling Google and GitHub OAuth sign-in.
 * @tech      Next.js, React, Supabase Auth
 * @connects  Imports useAuth and useGuardedRouter hooks
 * @apis      None
 * @db        Supabase Auth
 * @state     React local state
 * @env       NODE_ENV
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useSearchParams } from 'next/navigation';
import { useGuardedRouter } from '@/hooks/useGuardedRouter';
import { Suspense, useEffect, useState, useRef } from 'react';
import Image from 'next/image';

// ── Main Login Content ────────────────────────────────────────────────────────

function LoginContent() {
    const { user, signIn, signInWithEmail, loading, isConfigured } = useAuth();
    const router = useGuardedRouter();
    const searchParams = useSearchParams();

    const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasRedirected = useRef(false);
    const reason = searchParams.get('reason');

    // Redirect if already logged in
    useEffect(() => {
        if (user && !hasRedirected.current) {
            hasRedirected.current = true;
            const urlRedirect = searchParams.get('redirect');
            const target = urlRedirect || '/';
            router.push(target);
        }
    }, [user, searchParams]); // removed router from deps

    // Show error from URL params (OAuth failure / callback error)
    useEffect(() => {
        const errParam = searchParams.get('error');
        if (errParam) {
            const msg = searchParams.get('error_description') || errParam;
            setTimeout(() => setError(decodeURIComponent(msg)), 0);
        }
    }, [searchParams]);

    const handleOAuth = async (provider: 'google' | 'github') => {
        setOauthProvider(provider);
        setError(null);
        const { error: err } = await signIn(provider);
        if (err) { setError(err.message); setOauthProvider(null); }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--surface-base)' }}>
                <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 flex items-center justify-center p-4" style={{ background: 'var(--surface-base)' }}>
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-4">

                {/* ── Card ── */}
                <div className="glass rounded-3xl shadow-2xl p-8 space-y-6" style={{ border: '1px solid var(--surface-edge)' }}>
                    {/* Logo */}
                    <div className="text-center">
                        <div className="flex items-center justify-center mb-4">
                            <Image
                                src="/icon-192x192.png"
                                alt="AlgoMind"
                                width={48}
                                height={48}
                                className="rounded-xl drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]"
                            />
                        </div>
                        <h1 className="text-2xl font-black text-white mb-1 tracking-tight">Welcome to AlgoMind</h1>
                        <p className="text-zinc-400 text-sm">Sign in to track your DSA interview progress</p>
                    </div>

                    {(process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') && (
                        <div className="p-3 rounded-xl space-y-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}>
                            <p className="text-xs text-zinc-500">TEST AUTH (Dev/Test Only)</p>
                            <input 
                                data-testid="email-input"
                                type="email" 
                                placeholder="test@example.com"
                                id="test-email"
                                className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder:text-zinc-600"
                                style={{ background: 'var(--surface-base)', border: '1px solid var(--surface-edge)' }}
                            />
                            <input 
                                data-testid="password-input"
                                type="password" 
                                placeholder="password"
                                id="test-password"
                                className="w-full px-3 py-2 rounded-lg text-white text-sm placeholder:text-zinc-600"
                                style={{ background: 'var(--surface-base)', border: '1px solid var(--surface-edge)' }}
                            />
                            <button 
                                data-testid="sign-in-button"
                                onClick={() => {
                                    const email = (document.getElementById('test-email') as HTMLInputElement)?.value;
                                    const password = (document.getElementById('test-password') as HTMLInputElement)?.value;
                                    if (email && password) {
                                        signInWithEmail(email, password);
                                    }
                                }}
                                className="w-full h-10 text-white font-semibold rounded-lg transition-all text-sm"
                                style={{ background: 'var(--accent-primary)' }}
                            >
                                Sign In with Email
                            </button>
                        </div>
                    )}

                    {reason === 'guest_disabled' && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm text-center">
                            Guest mode is currently disabled. Please sign in to continue.
                        </div>
                    )}

                    {/* OAuth Buttons */}
                    <div className="space-y-3">
                        <button data-testid="oauth-google" onClick={() => handleOAuth('google')} disabled={!!oauthProvider || !isConfigured}
                            className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 text-black font-semibold rounded-xl transition-all disabled:opacity-40 text-sm">
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                            {oauthProvider === 'google' ? 'Signing in...' : 'Continue with Google'}
                        </button>
                        <button onClick={() => handleOAuth('github')} disabled={!!oauthProvider || !isConfigured}
                            className="w-full h-12 flex items-center justify-center gap-3 text-white font-semibold rounded-xl transition-all disabled:opacity-40 text-sm hover:brightness-110"
                            style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge-hi)' }}>
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                            {oauthProvider === 'github' ? 'Signing in...' : 'Continue with GitHub'}
                        </button>
                    </div>

                    {/* Feedback */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">{error}</div>
                    )}

                    <p className="text-center text-xs text-zinc-600">
                        By continuing you agree to our{' '}
                        <a href="/legal/terms" className="text-indigo-400 hover:text-indigo-300 transition-colors">Terms of Service</a>
                        {' '}and{' '}
                        <a href="/legal/privacy" className="text-indigo-400 hover:text-indigo-300 transition-colors">Privacy Policy</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center" style={{ background: 'var(--surface-base)' }}><div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    );
}
