'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PDFReport } from './PDFReport';
import { UserProgress } from '@/types/assessment';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';

interface ExportReportButtonProps {
    progress: UserProgress | null;
}

export function ExportReportButton({ progress }: ExportReportButtonProps) {
    const [isClient, setIsClient] = useState(false);
    const [hasClicked, setHasClicked] = useState(false);
    const buttonRef = useRef<HTMLAnchorElement>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!progress || !isClient) {
        return (
            <Button variant="outline" disabled className="border-slate-800 bg-slate-900/50 text-slate-500 h-11 px-6 font-bold">
                <FileDown className="w-4 h-4 mr-2" />
                Export Report
            </Button>
        );
    }

    return (
        <PDFDownloadLink
            document={<PDFReport progress={progress} />}
            fileName={`algomind-report-${progress.userId}-${new Date().getTime()}.pdf`}
        >
            {({ blob, url, loading, error }) => {
                // Only show loading state after user has clicked
                const showLoading = hasClicked && loading;
                return (
                    <Button
                        variant="outline"
                        disabled={showLoading}
                        onClick={() => setHasClicked(true)}
                        className="border-slate-800 bg-slate-900/50 hover:bg-slate-800 text-slate-300 h-11 px-6 font-bold shadow-lg transition-all active:scale-95"
                        data-id="export-report-btn"
                    >
                        {showLoading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <FileDown className="w-4 h-4 mr-2" />
                        )}
                        {showLoading ? 'Generating...' : 'Export Report'}
                    </Button>
                );
            }}
        </PDFDownloadLink>
    );
}
