/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { UserProgress, CognitiveSkill } from '@/types/assessment';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';

interface SessionExportData {
    score: number;
    skills: Record<string, number>;
    feedback: string;
    nextSteps: string[];
    problemTitle: string;
}

interface ExportReportButtonProps {
    progress?: UserProgress | null;
    sessionData?: SessionExportData;
}

// Lazy-load the entire PDF library — only downloads when user first needs it
// Loading fallback renders a disabled button to prevent layout shift
const LazyPDFDownloadLink = dynamic(
    () => import('@react-pdf/renderer').then((mod) => {
        // We need PDFReport in scope when the dynamic component renders.
        // Import it here to ensure it's in the same lazy chunk.
        return import('./PDFReport').then((reportMod) => {
            // Return a wrapper component that has both in scope
            const { PDFDownloadLink } = mod;
            const { PDFReport } = reportMod;

            function PDFLinkWrapper({
                progress,
                fileName,
                children,
            }: {
                progress: UserProgress;
                fileName: string;
                children: (state: { blob: Blob | null; url: string | null; loading: boolean; error: Error | null }) => React.ReactNode;
            }) {
                return (
                    <PDFDownloadLink
                        document={<PDFReport progress={progress} />}
                        fileName={fileName}
                    >
                        {children}
                    </PDFDownloadLink>
                );
            }

            return PDFLinkWrapper;
        });
    }),
    {
        ssr: false,
        loading: () => (
            <Button disabled className="btn-primary h-11 px-6 font-bold opacity-70">
                <FileDown className="w-4 h-4 mr-2" />
                Download Report
            </Button>
        ),
    }
);

function sessionToProgress(data: SessionExportData): UserProgress {
    return {
        userId: 'Session Report',
        totalSessions: 1,
        averageScore: data.score,
        averageScores: data.skills as Record<CognitiveSkill, number>,
        sessions: [{
            sessionId: 'current',
            userId: 'Session Report',
            problemId: '',
            problemDifficulty: 'medium' as const,
            overallScore: data.score,
            timestamp: new Date(),
            duration: 0,
            skills: data.skills as Record<CognitiveSkill, number>,
        }],
        trends: [],
        lastUpdated: new Date(),
        narrative: data.feedback,
        next_steps: data.nextSteps,
    };
}

export function ExportReportButton({ progress, sessionData }: ExportReportButtonProps) {
    const [isClient, setIsClient] = useState(false);
    const [hasClicked, setHasClicked] = useState(false);
    const buttonRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const resolvedProgress = progress ?? (sessionData ? sessionToProgress(sessionData) : null);

    if (!resolvedProgress || !isClient) {
        return (
            <Button disabled className="btn-primary opacity-50 cursor-not-allowed h-11 px-6 font-bold">
                <FileDown className="w-4 h-4 mr-2" />
                Download Report
            </Button>
        );
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const candidateName = resolvedProgress.userId;

    return (
        <LazyPDFDownloadLink
            progress={resolvedProgress}
            fileName={`AlgoMind_Report_${candidateName.replace(/ /g, '_')}_${dateStr}.pdf`}
        >
            {({ blob, url, loading, error }) => {
                // Only show loading state after user has clicked
                const showLoading = hasClicked && loading;
                return (
                    <Button
                        disabled={showLoading}
                        onClick={() => setHasClicked(true)}
                        className="btn-primary h-11 px-6 font-bold shadow-lg transition-all active:scale-95"
                        data-id="export-report-btn"
                    >
                        {showLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileDown className="w-4 h-4 mr-2" />
                        )}
                        {showLoading ? 'Generating...' : 'Download Report'}
                    </Button>
                );
            }}
        </LazyPDFDownloadLink>
    );
}
