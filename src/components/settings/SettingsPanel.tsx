'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isDemoMode, enableDemoMode, disableDemoMode } from '@/lib/demo/manager';
import { resetOnboarding, shouldShowOnboarding, markOnboardingComplete } from '@/lib/onboarding/manager';
import { useAuth } from '@/components/auth/AuthProvider';
import { getSupabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, LogOut, Database, Shield, Play, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { VoiceSettings } from './VoiceSettings';
import { LeetCodeSettings } from './LeetCodeSettings';

export function SettingsPanel() {
    const [introEnabled, setIntroEnabled] = useState(false);
    const [demoMode, setDemoMode] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [_isClearing, setIsClearing] = useState(false);
    const { user, signOut, isConfigured } = useAuth();
    const router = useRouter();


    useEffect(() => {
        setMounted(true);
        setIntroEnabled(shouldShowOnboarding());
        setDemoMode(isDemoMode());

        const handleDemoChange = (e: CustomEvent<{ enabled: boolean }>) => {
            setDemoMode(e.detail.enabled);
        };

        window.addEventListener('demo-mode-changed', handleDemoChange as EventListener);
        return () => {
            window.removeEventListener('demo-mode-changed', handleDemoChange as EventListener);
        };
    }, []);

    const _toggleIntro = () => {
        // ... (existing toggleIntro logic)
        if (introEnabled) {
            markOnboardingComplete();
            toast.success('Intro animation disabled for next visit');
        } else {
            resetOnboarding();
            toast.success('Intro animation enabled for next visit');
        }
        setIntroEnabled(!introEnabled);
    };

    const handleExitDemo = () => {
        disableDemoMode();
        window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: false } }));
        toast.success('Demo mode disabled');
        router.refresh();
    };

    const handleStartDemoTour = () => {
        // Event listener in TourContext checks this
        if (!demoMode) {
            enableDemoMode();
            window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: true } }));
        }
        window.dispatchEvent(new CustomEvent('start-tour'));
    };

    const _handleClearData = async () => {
        if (!confirm('Are you sure? This will delete ALL your interview sessions and progress. This cannot be undone!')) {
            return;
        }

        setIsClearing(true);

        try {
            // Clear localStorage
            localStorage.clear();
            // Force disable demo mode in state/UI too
            disableDemoMode();

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
            router.refresh();
        } catch (error) {
            console.error('Failed to clear data:', error);
            toast.error('Failed to clear data. Please try again.');
        } finally {
            setIsClearing(false);
        }
    };

    const handleSignOut = async () => {
        disableDemoMode(); // Ensure demo mode is off on logout
        window.dispatchEvent(new CustomEvent('demo-mode-changed', { detail: { enabled: false } }));
        await signOut();
        toast.success('Signed out successfully');
        router.push('/');
    };

    if (!mounted) return null;

    return (
        <div className="space-y-10">
            {/* User Profile Card */}
            {/* Profile Section */}
            <div className="space-y-2 mb-8">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600">
                    Profile Outline
                </h2>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    {user ? (
                        <div className="flex items-center gap-4 px-5 py-4">
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
                                <p className="text-lg font-semibold text-zinc-200 truncate">
                                    {user.user_metadata?.full_name || 'AlgoMind User'}
                                </p>
                                <p className="text-sm text-zinc-500 truncate">{user.email}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="px-5 py-6 text-center">
                            <p className="text-zinc-400 mb-3">You're using AlgoMind as a guest</p>
                            <Button onClick={() => router.push('/login')} className="btn-primary">
                                Sign In for Cloud Sync
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Voice Settings */}
            <VoiceSettings />

            {/* Storage Info */}
            <div className="space-y-2 mb-8">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600">
                    Data Storage
                </h2>
                <div className="rounded-2xl overflow-hidden px-5 py-4 flex flex-col gap-1"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    <div className="flex items-center gap-2">
                        <Shield className={`w-4 h-4 ${isConfigured ? 'text-emerald-400' : 'text-zinc-400'}`} />
                        <span className="text-sm font-semibold text-zinc-200">
                            {isConfigured ? 'Cloud Sync Enabled' : 'Local Storage Only'}
                        </span>
                    </div>
                    <p className="text-xs text-zinc-500 ml-6">
                        {isConfigured
                            ? 'Your data is securely stored in the cloud and syncs across devices.'
                            : 'Data is stored locally in your browser. Sign in to enable cloud sync.'}
                    </p>
                </div>
            </div>

            {/* App Settings */}
            <div className="space-y-2 mb-8">
                <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600">
                    Application Info
                </h2>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                    {/* Combined Demo & Tour Control */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-edge)]" data-tour="intro-button">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                {demoMode ? (
                                    <FlaskConical className="w-5 h-5 text-purple-400" />
                                ) : (
                                    <Play className="w-5 h-5 text-blue-400" />
                                )}
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-zinc-200">
                                    {demoMode ? 'Demo Mode Active' : 'Interactive Demo'}
                                </h3>
                                <p className="text-xs text-zinc-500 mt-0.5">
                                    {demoMode
                                        ? 'Sample data loaded. Exit to clear.'
                                        : 'Experience AlgoMind with sample data and tour'}
                                </p>
                            </div>
                        </div>

                        {demoMode ? (
                            <Button
                                onClick={handleExitDemo}
                                variant="destructive"
                                className="h-8 text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-900/50"
                            >
                                Exit Demo Mode
                            </Button>
                        ) : (
                            <Button
                                onClick={handleStartDemoTour}
                                variant="default"
                                className="h-8 text-xs font-bold btn-primary"
                            >
                                Start Demo Tour
                            </Button>
                        )}
                    </div>

                    {/* Version info */}
                    <div className="px-5 py-4 text-xs text-zinc-500 leading-relaxed flex items-center justify-between">
                        <div>
                            <p className="font-semibold text-zinc-400">AlgoMind</p>
                            <p>Built with Next.js 15, Gemini AI, and Groq</p>
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-widest">v1.1.0</p>
                    </div>
                </div>
            </div>

            {/* LeetCode Integration */}
            <LeetCodeSettings />

            {/* Danger Zone */}
            <div className="space-y-2 pb-16">
                <h2 className="text-xs font-black uppercase tracking-widest text-red-500/80">
                    Danger Zone
                </h2>
                <div className="rounded-2xl overflow-hidden"
                    style={{ background: 'var(--surface-1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(239,68,68,0.1)]">
                        <div>
                            <p className="text-sm font-semibold text-red-400">Sign Out</p>
                            <p className="text-xs text-red-400/60 mt-0.5">Disconnect your account from this device.</p>
                        </div>
                        <Button
                            onClick={handleSignOut}
                            variant="destructive"
                            className="h-8 text-xs font-bold"
                        >
                            Sign Out
                        </Button>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4">
                        <div>
                            <p className="text-sm font-semibold text-red-400">Clear All Data</p>
                            <p className="text-xs text-red-400/60 mt-0.5">Permanently delete all sessions and assessments.</p>
                        </div>
                        <Button
                            onClick={_handleClearData}
                            disabled={_isClearing}
                            variant="destructive"
                            className="h-8 text-xs font-bold"
                        >
                            {_isClearing ? 'Clearing...' : 'Clear Data'}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
