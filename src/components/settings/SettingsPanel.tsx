'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enableDemoMode, disableDemoMode, isDemoMode } from '@/lib/demo/manager';
import { resetOnboarding, shouldShowOnboarding, markOnboardingComplete } from '@/lib/onboarding/manager';
import { useAuth } from '@/components/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical, RotateCcw, Trash2, ArrowLeft, User, LogOut, Database, Shield, Play } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { VoiceSettings } from './VoiceSettings';

export function SettingsPanel() {
    const [demoMode, setDemoMode] = useState(false);
    const [introEnabled, setIntroEnabled] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const { user, signOut, isConfigured } = useAuth();
    const router = useRouter();

    useEffect(() => {
        setMounted(true);
        setDemoMode(isDemoMode());
        setIntroEnabled(shouldShowOnboarding());
    }, []);

    const toggleDemoMode = () => {
        if (demoMode) {
            disableDemoMode();
            toast.success('Demo mode disabled');
        } else {
            enableDemoMode();
            toast.success('Demo mode enabled');
        }
        const newMode = !demoMode;
        setDemoMode(newMode);

        // Emit custom event for DemoBanner to react immediately
        window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: newMode } }));

        router.refresh();
    };

    const toggleIntro = () => {
        if (introEnabled) {
            markOnboardingComplete();
            toast.success('Intro animation disabled for next visit');
        } else {
            resetOnboarding();
            toast.success('Intro animation enabled for next visit');
        }
        setIntroEnabled(!introEnabled);
    };

    const handleClearData = async () => {
        if (!confirm('Are you sure? This will delete ALL your interview sessions and progress. This cannot be undone!')) {
            return;
        }

        setIsClearing(true);

        try {
            // Clear localStorage
            localStorage.clear();

            // If authenticated and Supabase is configured, clear database
            if (user && isConfigured) {
                const supabase = getSupabase();
                if (supabase) {
                    // Delete assessments first (foreign key constraint)
                    await supabase
                        .from('assessments')
                        .delete()
                        .eq('user_id', user.id);

                    // Delete sessions
                    await supabase
                        .from('interview_sessions')
                        .delete()
                        .eq('user_id', user.id);
                }
            }

            toast.success('All data cleared successfully!');
            toast.success('All data cleared successfully!');
            router.refresh();
        } catch (error) {
            console.error('Failed to clear data:', error);
            toast.error('Failed to clear data. Please try again.');
        } finally {
            setIsClearing(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        toast.success('Signed out successfully');
        router.push('/');
    };

    if (!mounted) return null;

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
            </Link>

            <h1 className="text-3xl font-bold text-white">Settings</h1>

            {/* User Profile Card */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <User className="w-5 h-5" />
                        Profile
                    </CardTitle>
                    <CardDescription>Your account information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {user ? (
                        <>
                            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                                {user.user_metadata?.avatar_url ? (
                                    <img
                                        src={user.user_metadata.avatar_url}
                                        alt={user.email || 'User'}
                                        className="w-16 h-16 rounded-full ring-2 ring-slate-600"
                                    />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                                        {user.email?.[0].toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <p className="text-lg font-semibold text-white truncate">
                                        {user.user_metadata?.full_name || 'AlgoMind User'}
                                    </p>
                                    <p className="text-slate-400 truncate">{user.email}</p>
                                </div>
                            </div>

                            <Button
                                onClick={handleSignOut}
                                variant="destructive"
                                className="w-full bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-900/50 transition-all font-bold"
                            >
                                <LogOut className="w-4 h-4 mr-2" />
                                Sign Out
                            </Button>
                        </>
                    ) : (
                        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
                            <p className="text-slate-400 mb-3">You're using AlgoMind as a guest</p>
                            <Button onClick={() => router.push('/login')}>
                                Sign In for Cloud Sync
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Voice Settings */}
            <VoiceSettings />

            {/* Storage Info */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Data Storage
                    </CardTitle>
                    <CardDescription>Where your data is stored</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="flex items-center gap-2 mb-2">
                            <Shield className={`w-4 h-4 ${isConfigured ? 'text-emerald-400' : 'text-yellow-400'}`} />
                            <span className="font-medium text-white">
                                {isConfigured ? 'Cloud Storage (Supabase)' : 'Local Storage Only'}
                            </span>
                        </div>
                        <p className="text-sm text-slate-400">
                            {isConfigured
                                ? 'Your data is securely stored in the cloud and syncs across devices.'
                                : 'Data is stored locally in your browser. Sign in to enable cloud sync.'}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* App Settings */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">App Settings</CardTitle>
                    <CardDescription>Configure AlgoMind options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Demo Mode */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700" data-tour="demo-mode">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <FlaskConical className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Demo Mode</h3>
                                <p className="text-sm text-slate-400">Load sample data for presentations</p>
                            </div>
                        </div>
                        {/* Toggle Switch */}
                        <button
                            onClick={toggleDemoMode}
                            className={cn(
                                "relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50",
                                demoMode ? "bg-purple-600" : "bg-slate-700"
                            )}
                            role="switch"
                            aria-checked={demoMode}
                        >
                            <span
                                className={cn(
                                    "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300",
                                    demoMode ? "left-8" : "left-1"
                                )}
                            />
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700" data-tour="intro-button">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <Play className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Intro Tour</h3>
                                <p className="text-sm text-slate-400">Restart the guided tour</p>
                            </div>
                        </div>
                        {/* Start Tour Button */}
                        <Button
                            onClick={() => window.dispatchEvent(new CustomEvent('start-tour'))}
                            variant="outline"
                            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                        >
                            Start Tour
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* App Info */}
            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">About AlgoMind</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-400 space-y-2">
                    <p>Version: 1.0.0 (Beta)</p>
                    <p>Built with Next.js 14, Gemini AI, and Groq</p>
                    <p className="text-slate-500 text-xs mt-4">© 2026 AlgoMind Team. All rights reserved.</p>
                </CardContent>
            </Card>
        </div>
    );
}
