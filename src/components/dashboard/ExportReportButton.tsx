/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFReport } from './PDFReport';
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
        <PDFDownloadLink
            document={<PDFReport progress={resolvedProgress} />}
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
        </PDFDownloadLink>
    );
}
