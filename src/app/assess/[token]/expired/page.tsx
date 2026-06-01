/**
 * @codesage
 * @file      src/app/assess/[token]/expired/page.tsx
 * @purpose   Shows expired/inactive message for assessment link
 * @tech      Next.js, React, Tailwind, Lucide React
 * @connects  next/link, @/components/ui/card, @/components/ui/button
 * @apis      none
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight } from 'lucide-react';

export default function AssessmentExpiredPage() {
    return (
        <div className="min-h-screen bg-[var(--surface-base)] flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 bg-[var(--surface-1)] border-white/8 text-center">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="w-10 h-10 text-amber-500" strokeWidth={1.5} />
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">Link Expired or Inactive</h1>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                    This interview link is no longer active. It may have expired, or the hiring team has closed the assessment campaign.
                </p>

                <div className="pt-6 border-t border-white/8">
                    <p className="text-sm font-medium text-zinc-300 mb-4">
                        Still want to practice your technical skills?
                    </p>
                    <Link href="/">
                        <Button className="w-full bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-white group">
                            Try AlgoMind AI Interviews
                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
