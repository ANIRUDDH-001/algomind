'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Sparkles, ArrowRight } from 'lucide-react';

export function AssessmentCompleteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [score, setScore] = useState<number | null>(null);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        const scoreParam = searchParams.get('score');
        if (scoreParam) {
            setScore(parseFloat(scoreParam));
        }

        // Trigger animations after a tiny delay for effect
        setTimeout(() => setIsAnimating(true), 100);
    }, [searchParams]);

    // Simple circle properties for gauge
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    // Map score 0-10 to arc
    const scoreOffset = score ? circumference - (score / 10) * circumference : circumference;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <Card className={`max-w-md w-full p-8 bg-slate-900 border-slate-800 text-center transition-all duration-1000 transform ${isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>

                {/* CSS Animated Checkmark */}
                <div className="mx-auto w-24 h-24 mb-8 relative">
                    <div className="absolute inset-0 bg-green-500/10 rounded-full animate-pulse"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Check className="w-12 h-12 text-green-500 will-change-transform" strokeWidth={3} />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-4">Interview Complete</h1>
                <p className="text-slate-400 mb-8 leading-relaxed">
                    Your response has been submitted to the hiring team. You&apos;ll hear from them directly regarding next steps.
                </p>

                {/* Optional Score Gauge */}
                {score !== null && (
                    <div className={`mb-10 p-6 bg-slate-950/50 rounded-xl border border-slate-800 transition-all duration-1000 delay-500 ${isAnimating ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                        <h3 className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">Your Performance</h3>
                        <div className="relative w-32 h-32 mx-auto justify-center items-center flex">
                            <svg className="transform -rotate-90 w-32 h-32">
                                <circle
                                    cx="64" cy="64" r={radius}
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    className="text-slate-800"
                                />
                                <circle
                                    cx="64" cy="64" r={radius}
                                    stroke="currentColor" strokeWidth="8" fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={scoreOffset}
                                    strokeLinecap="round"
                                    className={`transition-all duration-1000 ease-out ${score >= 7 ? 'text-green-500' : score >= 4 ? 'text-amber-500' : 'text-red-500'}`}
                                    style={{ transitionDelay: '800ms' }}
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-white">{score.toFixed(1)}</span>
                                <span className="text-xs text-slate-500">/ 10</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Viral CTA Loop */}
                <div className="border-t border-slate-800 pt-8 mt-4">
                    <div className="flex justify-center mb-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <Sparkles className="w-6 h-6 text-blue-500" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Want to improve for next time?</h3>
                    <p className="text-sm text-slate-400 mb-6">
                        AlgoMind offers AI-powered technical interviews that adapt to your skill level. Practice standard DSA and behavioral questions instantly.
                    </p>

                    <Button
                        onClick={() => router.push('/')}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg font-medium group"
                    >
                        Practice on AlgoMind
                        <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </Card>
        </div>
    );
}
