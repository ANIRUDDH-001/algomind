'use client';

import React from 'react';
import Link from 'next/link';
import { PROBLEMS } from '@/lib/data/problems';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Brain, ArrowLeft } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function ProblemsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 lg:p-8 pt-20 lg:pt-8">
            <div className="max-w-4xl mx-auto">
                <header className="mb-8 lg:mb-12">
                    <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Link>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
                        <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 shrink-0">
                            <Brain className="w-8 h-8 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                                DSA Problem Library
                            </h1>
                            <p className="text-slate-400 text-sm lg:text-base">Select a problem to start your AI-powered interview practice</p>
                        </div>
                    </div>
                </header>

                <div className="grid gap-4">
                    {PROBLEMS.map((problem) => (
                        <Card key={problem.id} className="bg-slate-900/40 border-slate-800 hover:border-blue-500/30 transition-all group">
                            <CardContent className="p-4 lg:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h3 className="text-lg lg:text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                            {problem.title}
                                        </h3>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                "text-[10px] h-5",
                                                problem.difficulty === 'easy' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5' :
                                                    problem.difficulty === 'medium' ? 'border-amber-500/30 text-amber-400 bg-amber-500/5' :
                                                        'border-red-500/30 text-red-400 bg-red-500/5'
                                            )}
                                        >
                                            {problem.difficulty}
                                        </Badge>
                                    </div>
                                    <p className="text-slate-500 text-xs lg:text-sm">{problem.category}</p>
                                </div>
                                <Link href={`/interview?problemId=${problem.id}`} className="w-full sm:w-auto">
                                    <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold">
                                        Start Practice
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
