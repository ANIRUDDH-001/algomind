/**
 * @codesage
 * @file      src/components/enterprise/CandidateTranscriptViewer.tsx
 * @purpose   Displays the full transcript of a candidate's interview session.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/components/ui/card
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

//  -- automated unused local suppression
import React from 'react';
//  -- automated unused local suppression
import { Card } from '@/components/ui/card';
//  -- automated unused local suppression
import { Button } from '@/components/ui/button';
import { MessageSquare, User, Bot, Clock } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';

interface CandidateTranscriptViewerProps {
    reportData: any;
    candidateName: string;
    onClose: () => void;
}

export function CandidateTranscriptViewer({ reportData, candidateName, onClose }: CandidateTranscriptViewerProps) {
    if (!reportData) return null;

    const questionsWithTranscript = (reportData.questions || []).filter((q: any) => q.transcript && q.transcript.length > 0);

    const modalTitle = (
        <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-400" />
            <span className="text-xl">{candidateName}&apos;s Full Transcript</span>
        </div>
    );

    const modalDescription = (
        <span className="text-zinc-400">
            {reportData.campaign?.title} • {questionsWithTranscript.length} question(s) recorded
        </span>
    );

    return (
        <ResponsiveModal
            open={true}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
            title={modalTitle}
            description={modalDescription}
            desktopClassName="max-w-4xl"
            className="p-0 border-white/10 bg-[var(--surface-1)]"
        >
            <div className="space-y-8 pb-4">
                {questionsWithTranscript.length === 0 ? (
                    <div className="p-12 text-center text-zinc-500 bg-[var(--surface-1)]/50 rounded-xl border border-white/8 mt-4">
                        <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No valid transcript was recorded for this session.</p>
                    </div>
                ) : (
                    questionsWithTranscript.map((q: any, qIdx: number) => (
                        <div key={qIdx} className="space-y-6 mt-4">
                            <div className="bg-[var(--surface-2)] border border-white/8 rounded-lg p-3 flex justify-between items-center sticky top-0 z-10 shadow-md">
                                <div className="font-bold text-zinc-200 text-sm">Question {qIdx + 1}: {q.title}</div>
                                <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono bg-[var(--surface-base)] px-2 py-1 rounded">
                                    <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {q.timeSpentMins}m / {q.timeLimitMins}m</div>
                                    <div className="hidden sm:block">|</div>
                                    <div className="uppercase font-bold text-zinc-300 hidden sm:block">{q.status}</div>
                                </div>
                            </div>
                            <div className="space-y-6 px-2">
                                {q.transcript.map((msg: any, i: number) => {
                                    const isUser = msg.speaker === 'user';
                                    const isSystem = msg.speaker === 'system';

                                    if (isSystem) return null;

                                    return (
                                        <div key={i} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-indigo-600 text-white' : 'bg-blue-600 border-2 border-[var(--surface-base)] text-white'}`}>
                                                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                            </div>
                                            <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                                                <span className="text-xs text-zinc-500 mb-1 font-medium px-1">
                                                    {isUser ? candidateName : 'KAI (Interviewer)'}
                                                </span>
                                                <div className={`p-4 rounded-2xl whitespace-pre-wrap leading-relaxed text-sm ${isUser
                                                    ? 'bg-indigo-500 text-white rounded-tr-sm border border-indigo-400/20'
                                                    : 'bg-[var(--surface-2)] text-zinc-200 rounded-tl-sm border border-white/10 shadow-sm'
                                                    }`}>
                                                    {msg.text || msg.content}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </ResponsiveModal>
    );
}
