'use client';

import { useState, useEffect } from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, Mic, LineChart, Code2, Sparkles, Settings } from "lucide-react";
import { IntroAnimation } from '@/components/onboarding/IntroAnimation';
import { shouldShowOnboarding, markOnboardingComplete } from '@/lib/onboarding/manager';

export default function Home() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setShowOnboarding(shouldShowOnboarding());
  }, []);

  const handleOnboardingComplete = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
  };

  // Don't render until mounted (avoid hydration mismatch)
  if (!mounted) {
    return null;
  }

  // Show onboarding animation for first-time visitors
  if (showOnboarding) {
    return <IntroAnimation onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-6 py-12">
        {/* Header */}
        <header className="flex items-center justify-between mb-20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">AlgoMind</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white">
                <LineChart className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <Badge
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Beta
            </Badge>
          </div>
        </header>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center space-y-8 mb-20">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent pb-4">
              AlgoMind
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 max-w-2xl">
              AI-Powered DSA Interview Practice with Real-Time Voice Coaching
            </p>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/interview">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8"
              >
                <Mic className="w-5 h-5 mr-2" />
                Start Voice Practice
              </Button>
            </Link>
            <Link href="/problems">
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800 px-8"
              >
                <Code2 className="w-5 h-5 mr-2" />
                Browse Problems
              </Button>
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="bg-slate-900/50 border-slate-800 hover:border-blue-500/50 transition-all duration-300 group">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Mic className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Voice Interview</h3>
              <p className="text-slate-400 text-sm">
                Practice with natural voice conversations powered by Gemini AI. Get real-time feedback as you explain your approach.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 hover:border-purple-500/50 transition-all duration-300 group">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Brain className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Cognitive Analysis</h3>
              <p className="text-slate-400 text-sm">
                Get detailed insights into your problem-solving patterns. Track decomposition, pattern recognition, and optimization skills.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 hover:border-cyan-500/50 transition-all duration-300 group">
            <CardContent className="p-6 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                <LineChart className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold text-white">Progress Dashboard</h3>
              <p className="text-slate-400 text-sm">
                Visualize your growth with radar charts and skill progression graphs. Export detailed PDF reports of your journey.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer Banner */}
        <div className="mt-20 text-center">
          <p className="text-sm text-slate-500">
            Built with Next.js 14 • Gemini AI • RAG Pipeline • Voice Recognition
          </p>
        </div>
      </div>
    </div>
  );
}
