'use client';

import React from 'react';
import { LogIn, Sparkles, History, Target, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface GuestRegisterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function GuestRegisterModal({ isOpen, onClose }: GuestRegisterModalProps) {
    const router = useRouter();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl relative overflow-hidden group">
                {/* Visual Flair */}
                <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-600/20 blur-3xl rounded-full group-hover:bg-blue-600/30 transition-colors duration-500" />
                <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-600/20 blur-3xl rounded-full group-hover:bg-indigo-600/30 transition-colors duration-500" />

                <div className="text-center space-y-8 relative z-10">
                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                        <Sparkles className="w-10 h-10 text-white animate-pulse" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-3xl font-extrabold text-white tracking-tight">Level Up Your Preparation</h2>
                        <p className="text-slate-400 text-lg">
                            You&apos;ve completed your guest trial. Sign in to unlock the full AlgoMind experience.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                        <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <History className="w-5 h-5 text-blue-400 mt-1" />
                            <div>
                                <h4 className="font-semibold text-white text-sm">Session Persistence</h4>
                                <p className="text-slate-400 text-xs">Save transcripts and track your growth over time.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <Target className="w-5 h-5 text-indigo-400 mt-1" />
                            <div>
                                <h4 className="font-semibold text-white text-sm">Advanced Insights</h4>
                                <p className="text-slate-400 text-xs">Deep-dive analysis on your coding patterns.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <ShieldCheck className="w-5 h-5 text-emerald-400 mt-1" />
                            <div>
                                <h4 className="font-semibold text-white text-sm">Full Library</h4>
                                <p className="text-slate-400 text-xs">Access 250+ community & premium problems.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                            <LogIn className="w-5 h-5 text-purple-400 mt-1" />
                            <div>
                                <h4 className="font-semibold text-white text-sm">Instant Auth</h4>
                                <p className="text-slate-400 text-xs">Secure login with Github or Google.</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => router.push('/login')}
                            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-6 text-lg rounded-2xl shadow-lg shadow-blue-900/20"
                        >
                            Get Started for Free
                        </Button>
                        <button
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
                        >
                            Continue Browsing
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
