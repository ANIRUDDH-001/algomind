'use client';

import { useState, useEffect } from 'react';
import { enableDemoMode, disableDemoMode, isDemoMode } from '@/lib/demo/manager';
import { resetOnboarding } from '@/lib/onboarding/manager';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FlaskConical, RotateCcw, Trash2, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export function SettingsPanel() {
    const [demoMode, setDemoMode] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [actionFeedback, setActionFeedback] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        setDemoMode(isDemoMode());
    }, []);

    const showFeedback = (message: string) => {
        setActionFeedback(message);
        setTimeout(() => setActionFeedback(null), 2000);
    };

    const toggleDemoMode = () => {
        if (demoMode) {
            disableDemoMode();
            showFeedback('Demo mode disabled');
        } else {
            enableDemoMode();
            showFeedback('Demo mode enabled');
        }
        setDemoMode(!demoMode);
        setTimeout(() => window.location.reload(), 500);
    };

    const handleResetOnboarding = () => {
        resetOnboarding();
        showFeedback('Onboarding reset! Refreshing...');
        setTimeout(() => window.location.href = '/', 1000);
    };

    const handleClearData = () => {
        if (confirm('Are you sure? This will delete all your progress and cannot be undone.')) {
            localStorage.clear();
            showFeedback('All data cleared!');
            setTimeout(() => window.location.reload(), 500);
        }
    };

    if (!mounted) return null;

    return (
        <div className="space-y-6">
            {/* Back Link */}
            <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
            </Link>

            {/* Feedback Toast */}
            {actionFeedback && (
                <div className="fixed top-4 right-4 bg-emerald-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-top duration-200 z-50">
                    <CheckCircle className="w-4 h-4" />
                    {actionFeedback}
                </div>
            )}

            <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white">Settings</CardTitle>
                    <CardDescription>Configure AlgoMind options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Demo Mode */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/20">
                                <FlaskConical className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Demo Mode</h3>
                                <p className="text-sm text-slate-400">Load sample data for presentations</p>
                            </div>
                        </div>
                        <Button
                            onClick={toggleDemoMode}
                            variant={demoMode ? 'default' : 'outline'}
                            className={demoMode ? 'bg-purple-600 hover:bg-purple-700' : ''}
                        >
                            {demoMode ? 'Enabled' : 'Enable'}
                        </Button>
                    </div>

                    {/* Reset Onboarding */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20">
                                <RotateCcw className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Reset Onboarding</h3>
                                <p className="text-sm text-slate-400">Show the intro animation again</p>
                            </div>
                        </div>
                        <Button onClick={handleResetOnboarding} variant="outline">
                            Reset
                        </Button>
                    </div>

                    {/* Clear All Data */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-red-950/30 border border-red-900/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-red-500/20">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Clear All Data</h3>
                                <p className="text-sm text-slate-400">Delete all progress and sessions</p>
                            </div>
                        </div>
                        <Button onClick={handleClearData} variant="destructive">
                            Clear Data
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
