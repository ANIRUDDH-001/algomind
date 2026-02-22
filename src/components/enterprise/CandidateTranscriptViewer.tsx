'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, X, Loader2, User, Bot } from 'lucide-react';

interface CandidateTranscriptViewerProps {
    sessionId: string;
    candidateName: string;
    onClose: () => void;
}

export function CandidateTranscriptViewer({ sessionId, candidateName, onClose }: CandidateTranscriptViewerProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<{
        transcript: { role: string; content: string }[];
        duration: number;
        created_at: string;
        completed_at?: string;
        problem_title: string;
    } | null>(null);

    useEffect(() => {
        async function fetchTranscript() {
            setLoading(true);
            try {
                const res = await fetch(`/api/employer/transcript/${sessionId}`);
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to load transcript');
                }
                const result = await res.json();
                setData(result.session);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchTranscript();
    }, [sessionId]);

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <Card className="bg-slate-900 border-slate-700 w-full max-w-4xl shadow-2xl flex flex-col my-auto max-h-[90vh] overflow-hidden">
                <div className="p-4 sm:p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 shrink-0">
                    <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-400" />
                            {candidateName}&apos;s Interview
                        </h3>
                        {data && (
                            <p className="text-sm text-slate-400 mt-1">
                                {data.problem_title} • Duration: {Math.floor(data.duration / 60)}m {data.duration % 60}s
                            </p>
                        )}
                    </div>
                    <Button variant="ghost" onClick={onClose} size="sm" className="text-slate-400 hover:text-white shrink-0 h-10 w-10 p-0">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-950/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                            <p>Loading candidate transcript...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-center">
                            <p>{error}</p>
                            <Button variant="outline" className="mt-4 border-red-500/30 text-red-300 hover:bg-red-500/20" onClick={onClose}>
                                Close
                            </Button>
                        </div>
                    ) : !data || !data.transcript || data.transcript.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800">
                            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No valid transcript was recorded for this session.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {data.transcript.map((msg, i) => {
                                const isUser = msg.role === 'user';
                                const isSystem = msg.role === 'system';

                                if (isSystem) return null; // Hide system prompts from employer transcript

                                return (
                                    <div key={i} className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-indigo-600 text-white' : 'bg-blue-600 border-2 border-slate-900 text-white' // KAI colors
                                            }`}>
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
                                                {msg.content}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
