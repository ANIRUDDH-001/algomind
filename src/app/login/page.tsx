'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Brain, AlertTriangle, X } from 'lucide-react';

type AuthTab = 'email' | 'magic' | 'oauth';

// ── Outage Banner ─────────────────────────────────────────────────────────────

function OutageBanner() {
    const [dismissed, setDismissed] = useState(false);
    if (dismissed) return null;

    return (
        <div className="w-full bg-amber-950/80 border border-amber-500/50 rounded-2xl p-4 relative">
            <button
                onClick={() => setDismissed(true)}
                className="absolute top-3 right-3 text-amber-400/60 hover:text-amber-300 transition-colors"
                aria-label="Dismiss"
            >
                <X className="w-4 h-4" />
            </button>

            <div className="flex gap-3">
                <div className="shrink-0 mt-0.5">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                    </div>
                </div>
                <div className="space-y-1 pr-4">
                    <p className="text-amber-300 font-semibold text-sm">
                        🇮🇳 Supabase India Connectivity Issue
                    </p>
                    <p className="text-amber-200/80 text-xs leading-relaxed">
                        Supabase is currently experiencing DNS/connectivity disruptions affecting users in India.
                        Some services may be slow or temporarily unavailable.
                    </p>
                    <div className="pt-1 space-y-1">
                        <p className="text-amber-100/70 text-xs font-medium">Affected services:</p>
                        <ul className="text-amber-200/70 text-xs space-y-0.5 list-none">
                            <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block shrink-0" />
                                OAuth (Google / GitHub sign-in) — unreliable on mobile data
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block shrink-0" />
                                Email / password login — may be slow
                            </li>
                            <li className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block shrink-0" />
                                Magic link — most reliable option right now
                            </li>
                        </ul>
                    </div>
                    <p className="text-amber-200/50 text-xs pt-1">
                        We're aware and working on it. Use{' '}
                        <button
                            onClick={() => {/* handled by parent tab setter */ }}
                            className="text-amber-300 underline underline-offset-2 hover:text-amber-200 transition-colors"
                        >
                            Magic Link
                        </button>{' '}
                        for the best experience during this period.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Main Login Content ────────────────────────────────────────────────────────

function LoginContent() {
    const { user, signIn, signInWithEmail, signUpWithEmail, sendMagicLink, loading, isConfigured } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [tab, setTab] = useState<AuthTab>('magic'); // Default to magic link during outage
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [oauthProvider, setOauthProvider] = useState<'google' | 'github' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            const urlRedirect = searchParams.get('redirect');
            const target = urlRedirect || '/dashboard';
            router.push(target);
        }
    }, [user, router, searchParams]);

    // Show error from URL params (OAuth failure / callback error)
    useEffect(() => {
        const errParam = searchParams.get('error');
        if (errParam) {
            const msg = searchParams.get('error_description') || errParam;
            setTimeout(() => setError(decodeURIComponent(msg)), 0);
        }
    }, [searchParams]);

    const handleEmailSubmit = async () => {
        if (!email || !password) return;
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        const fn = isSignUp
            ? () => signUpWithEmail(email, password, fullName || undefined)
            : () => signInWithEmail(email, password);
        const { error: err } = await fn();
        if (err) setError(err.message);
        else if (isSignUp) setSuccess('Check your email to confirm your account, then sign in.');
        else router.push('/dashboard');
        setSubmitting(false);
    };

    const handleMagicLink = async () => {
        if (!email) return;
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        const { error: err } = await sendMagicLink(email);
        if (err) setError(err.message);
        else setSuccess('Magic link sent! Check your inbox.');
        setSubmitting(false);
    };

    const handleOAuth = async (provider: 'google' | 'github') => {
        setOauthProvider(provider);
        setError(null);
        const { error: err } = await signIn(provider);
        if (err) { setError(err.message); setOauthProvider(null); }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-4">

                {/* ── Outage Banner ── */}
                <OutageBanner />

                {/* ── Card ── */}
                <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 space-y-6">
                    {/* Logo */}
                    <div className="text-center">
                        <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                            <Brain className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-1">Welcome to AlgoMind</h1>
                        <p className="text-slate-400 text-sm">Sign in to track your DSA interview progress</p>
                    </div>

                    {!isConfigured && (
                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
                            ⚠️ Supabase is not configured. Check environment variables.
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex bg-slate-800 rounded-xl p-1 gap-1">
                        {(['email', 'magic', 'oauth'] as AuthTab[]).map(t => (
                            <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(null); }}
                                className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>
                                {t === 'email' ? '📧 Email' : t === 'magic' ? '✨ Magic Link' : '🔗 OAuth'}
                            </button>
                        ))}
                    </div>

                    {/* Email / Password */}
                    {tab === 'email' && (
                        <div className="space-y-3">
                            {isSignUp && (
                                <input type="text" placeholder="Full name (optional)"
                                    value={fullName} onChange={e => setFullName(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
                            )}
                            <input type="email" placeholder="Email address"
                                value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
                            <input type="password" placeholder="Password (min 10 chars)"
                                value={password} onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleEmailSubmit()}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
                            {isSignUp && (
                                <p className="text-slate-500 text-xs px-1">
                                    Must be ≥10 chars with uppercase, lowercase, number &amp; symbol (e.g. Algomind2@26)
                                </p>
                            )}
                            <button onClick={handleEmailSubmit} disabled={submitting || !email || !password || !isConfigured}
                                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-xl text-white font-bold transition-colors text-sm">
                                {submitting ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
                            </button>
                            <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccess(null); }}
                                className="w-full text-center text-xs text-slate-400 hover:text-slate-300 transition-colors py-1">
                                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
                            </button>
                        </div>
                    )}

                    {/* Magic Link */}
                    {tab === 'magic' && (
                        <div className="space-y-3">
                            <p className="text-slate-400 text-xs">Enter your email and we'll send a one-click login link. Works best during connectivity issues.</p>
                            <input type="email" placeholder="Email address"
                                value={email} onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleMagicLink()}
                                className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
                            <button onClick={handleMagicLink} disabled={submitting || !email || !isConfigured}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded-xl text-white font-bold transition-colors text-sm">
                                {submitting ? 'Sending...' : 'Send Magic Link'}
                            </button>
                        </div>
                    )}

                    {/* OAuth */}
                    {tab === 'oauth' && (
                        <div className="space-y-3">
                            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
                                ⚠️ OAuth is currently unreliable due to a Supabase India outage. Please use Email or Magic Link instead.
                            </div>
                            <button onClick={() => handleOAuth('google')} disabled={!!oauthProvider || !isConfigured}
                                className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl transition-all disabled:opacity-40 text-sm">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                {oauthProvider === 'google' ? 'Signing in...' : 'Continue with Google'}
                            </button>
                            <button onClick={() => handleOAuth('github')} disabled={!!oauthProvider || !isConfigured}
                                className="w-full h-12 flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all disabled:opacity-40 text-sm">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                                </svg>
                                {oauthProvider === 'github' ? 'Signing in...' : 'Continue with GitHub'}
                            </button>
                        </div>
                    )}

                    {/* Feedback */}
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">{error}</div>
                    )}
                    {success && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center">{success}</div>
                    )}

                    <p className="text-center text-xs text-slate-500">
                        By continuing you agree to our <a href="#" className="text-blue-400 hover:underline">Terms of Service</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><div className="w-10 h-10 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin" /></div>}>
            <LoginContent />
        </Suspense>
    );
}
