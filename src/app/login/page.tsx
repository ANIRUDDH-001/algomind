'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Brain, AlertCircle, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
    const { user, signIn, loading, isConfigured } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const authError = searchParams.get('error');

    useEffect(() => {
        if (user) {
            const redirectUrl = sessionStorage.getItem('redirectAfterLogin') || '/dashboard';
            sessionStorage.removeItem('redirectAfterLogin');
            router.push(redirectUrl);
        }
    }, [user, router]);

    useEffect(() => {
        if (authError) {
            setError('Authentication failed. Please try again.');
        }
    }, [authError]);

    const handleSignIn = async (provider: 'google' | 'github') => {
        setIsSigningIn(true);
        setError(null);

        const { error } = await signIn(provider);

        if (error) {
            setError(error.message);
            setIsSigningIn(false);
        }
        // Don't set isSigningIn to false on success - OAuth redirect will happen
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
            {/* Background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10 bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl mb-4">
                        <Brain className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome to AlgoMind</h1>
                    <p className="text-slate-400">Sign in to track your DSA interview progress</p>
                </div>

                {/* Not Configured Warning */}
                {!isConfigured && (
                    <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <div className="flex items-start gap-3 text-yellow-400">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium">Authentication Not Configured</p>
                                <p className="text-xs text-yellow-400/70 mt-1">
                                    Supabase credentials are not set up. You can continue as a guest or configure Supabase in .env.local
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Error message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 text-red-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm">{error}</span>
                    </div>
                )}

                {/* Sign in buttons */}
                <div className="space-y-4">
                    <Button
                        onClick={() => handleSignIn('google')}
                        disabled={isSigningIn || !isConfigured}
                        className="w-full h-12 flex items-center justify-center gap-3 bg-white hover:bg-slate-100 text-slate-900 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        {isSigningIn ? 'Signing in...' : 'Continue with Google'}
                    </Button>

                    <Button
                        onClick={() => handleSignIn('github')}
                        disabled={isSigningIn || !isConfigured}
                        className="w-full h-12 flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl transition-all border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                        </svg>
                        {isSigningIn ? 'Signing in...' : 'Continue with GitHub'}
                    </Button>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-sm text-slate-500">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-blue-400 hover:underline">Terms of Service</a>
                    </p>
                </div>

                {/* Guest mode link */}
                <div className="mt-8 pt-6 border-t border-slate-800 text-center">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                    >
                        Continue as Guest
                    </Link>
                    <p className="text-xs text-slate-500 mt-2">
                        Guest data is stored locally and won&apos;t sync across devices
                    </p>
                </div>
            </div>
        </div>
    );
}
