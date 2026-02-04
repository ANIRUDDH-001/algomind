'use client';

import { useState, useEffect } from 'react';
import { IntroAnimation } from '@/components/onboarding/IntroAnimation';
import { shouldShowOnboarding, markOnboardingComplete } from '@/lib/onboarding/manager';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Mic, BarChart, Brain, BookOpen } from 'lucide-react';

export default function HomePage() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      setShowOnboarding(shouldShowOnboarding());
    }
  }, [loading]);

  const handleOnboardingComplete = () => {
    markOnboardingComplete();
    setShowOnboarding(false);
    if (user) {
      router.push('/dashboard');
    }
  };

  if (showOnboarding) {
    return <IntroAnimation onComplete={handleOnboardingComplete} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-20">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-7xl font-bold text-white mb-4">AlgoMind</h1>
          <p className="text-2xl text-slate-300 mb-8">
            AI-Powered DSA Interview Practice
          </p>

          {user && (
            <p className="text-lg text-blue-400">
              Welcome back, <span className="font-semibold">{user.user_metadata?.full_name || user.email?.split('@')[0]}</span>!
            </p>
          )}
        </div>

        {/* Action Buttons - ALL SAME STYLE */}
        <div className="flex flex-wrap gap-4 justify-center mb-20">
          <Button
            onClick={() => router.push('/interview')}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg"
          >
            <Mic className="w-5 h-5 mr-2" />
            Quick Practice
          </Button>

          <Button
            onClick={() => router.push('/practice')}
            size="lg"
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg"
          >
            <BookOpen className="w-5 h-5 mr-2" />
            Browse Problems
          </Button>

          {user && (
            <Button
              onClick={() => router.push('/dashboard')}
              size="lg"
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg"
            >
              <BarChart className="w-5 h-5 mr-2" />
              View Dashboard
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-xl border border-slate-700">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Voice Interview</h3>
            <p className="text-slate-400">
              Practice with natural voice conversations powered by Gemini AI. Get real-time feedback as you explain your approach.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-xl border border-slate-700">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Cognitive Analysis</h3>
            <p className="text-slate-400">
              Get detailed insights into your problem-solving patterns. Track decomposition, pattern recognition, and optimization skills.
            </p>
          </div>

          <div className="bg-slate-800/50 backdrop-blur-sm p-8 rounded-xl border border-slate-700">
            <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4">
              <BarChart className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Progress Dashboard</h3>
            <p className="text-slate-400">
              Visualize your growth with radar charts and skill progression graphs. Export detailed PDF reports of your journey.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
