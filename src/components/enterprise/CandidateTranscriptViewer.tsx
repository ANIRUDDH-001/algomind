'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, User, Bot, Clock } from 'lucide-react';

interface CandidateTranscriptViewerProps {
    reportData: any;
    candidateName: string;
    onClose: () => void;
}

export function CandidateTranscriptViewer({ reportData, candidateName, onClose }: CandidateTranscriptViewerProps) {
    if (!reportData) return null;

    const questionsWithTranscript = (reportData.questions || []).filter((q: any) => q.transcript && q.transcript.length > 0);

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="bg-slate-900 border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                            {candidateName}&apos;s Full Transcript
                        </h3>
                        <p className="text-sm text-slate-400 mt-1">
                            {reportData.campaign?.title} • {questionsWithTranscript.length} question(s) recorded
                        </p>
                    </div>
                    <Button variant="ghost" onClick={onClose} size="sm" className="text-slate-400 hover:text-white shrink-0 h-10 w-10 p-0">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8 custom-scrollbar bg-slate-950/50">
                    {questionsWithTranscript.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No valid transcript was recorded for this session.</p>
                        </div>
                    ) : (
                        questionsWithTranscript.map((q: any, qIdx: number) => (
                            <div key={qIdx} className="space-y-6">
                                <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex justify-between items-center sticky top-0 z-10 shadow-md">
                                    <div className="font-bold text-slate-200 text-sm">Question {qIdx + 1}: {q.title}</div>
                                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono bg-slate-950 px-2 py-1 rounded">
                                        <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {q.timeSpentMins}m / {q.timeLimitMins}m</div>
                                        <div>|</div>
                                        <div className="uppercase font-bold text-slate-300">{q.status}</div>
                                    </div>
                                </div>
                                <div className="space-y-6 px-2">
                                    {q.transcript.map((msg: any, i: number) => {
                                        const isUser = msg.speaker === 'user';
                                        const isSystem = msg.speaker === 'system';

                                        if (isSystem) return null; // Hide system prompts from employer transcript

                                        return (
                                            <div key={i} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-indigo-600 text-white' : 'bg-blue-600 border-2 border-slate-900 text-white'}`}>
                                                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                                </div>
                                                <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                                                    <span className="text-xs text-slate-500 mb-1 font-medium px-1">
                                                        {isUser ? candidateName : 'KAI (Interviewer)'}
                                                    </span>
                                                    <div className={`p-4 rounded-2xl whitespace-pre-wrap leading-relaxed text-sm ${isUser
                                                        ? 'bg-indigo-500 text-white rounded-tr-sm border border-indigo-400/20'
                                                        : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700 shadow-sm'
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
            </Card>
        </div>
    );
}
