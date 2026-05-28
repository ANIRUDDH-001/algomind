'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Mic, 
  MicOff, 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  Sparkles,
  HelpCircle,
  TrendingUp,
  Award,
  ChevronRight
} from 'lucide-react';

interface SpeechBubble {
  id: string;
  sender: 'kai' | 'student';
  text: string;
  duration?: string;
  isPlaying?: boolean;
  cognitiveCategory?: 'decomposition' | 'pattern' | 'complexity' | 'communication' | 'optimization';
}

export default function Option1VoiceFirstConsole() {
  const [vadState, setVadState] = useState<'listening' | 'speaking' | 'processing' | 'idle'>('listening');
  const [isMuted, setIsMuted] = useState(false);
  const [turnCount, setTurnCount] = useState(5);
  const [dialogue, setDialogue] = useState<SpeechBubble[]>([
    {
      id: '1',
      sender: 'kai',
      text: "Excellent work on identifying the base cases. Now, let's address the recurrence relation. When we break down our merge sort function, we divide the array of size N into two halves. What is the time complexity of that split step?",
      duration: '0:14',
      cognitiveCategory: 'decomposition'
    },
    {
      id: '2',
      sender: 'student',
      text: "Splitting should take O(1) time because we just compute the middle index, right? And then we recursively sort both halves.",
      duration: '0:08'
    },
    {
      id: '3',
      sender: 'kai',
      text: "Spot on! Computing the middle index is indeed a constant time operation. Now, how much time does it take to merge those two sorted halves back together?",
      duration: '0:11',
      cognitiveCategory: 'complexity'
    },
    {
      id: '4',
      sender: 'student',
      text: "Ah, merging requires comparing elements from both arrays. Since we visit every element in the worst case, it should take linear time, O(N).",
      duration: '0:07'
    },
    {
      id: '5',
      sender: 'kai',
      text: "Perfect. So we have two subproblems of size N/2, and O(N) work for the merge step. Can you write down or state the full recurrence relation T(N) based on this?",
      duration: '0:15',
      cognitiveCategory: 'pattern',
      isPlaying: true
    }
  ]);

  const [activeBubbleId, setActiveBubbleId] = useState<string | null>('5');
  const [showVADHelp, setShowVADHelp] = useState(false);

  // VAD ring size cycle for realistic breathing simulation
  const [breathingScale, setBreathingScale] = useState(1);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (vadState === 'listening') {
      interval = setInterval(() => {
        setBreathingScale(prev => (prev === 1 ? 1.15 : 1));
      }, 1000);
    } else if (vadState === 'speaking') {
      interval = setInterval(() => {
        setBreathingScale(Math.random() * 0.3 + 0.95);
      }, 120);
    } else if (vadState === 'processing') {
      interval = setInterval(() => {
        setBreathingScale(prev => (prev === 0.9 ? 1.05 : 0.9));
      }, 400);
    } else {
      setBreathingScale(1);
    }
    return () => clearInterval(interval);
  }, [vadState]);

  const handlePlayBubble = (id: string) => {
    setActiveBubbleId(id);
    setDialogue(prev => 
      prev.map(bubble => ({
        ...bubble,
        isPlaying: bubble.id === id
      }))
    );
    setVadState('speaking');
  };

  const handleToggleState = () => {
    const states: ('listening' | 'speaking' | 'processing' | 'idle')[] = ['listening', 'speaking', 'processing', 'idle'];
    const nextIndex = (states.indexOf(vadState) + 1) % states.length;
    setVadState(states[nextIndex]);
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-white flex flex-col justify-between overflow-x-hidden relative noise-overlay">
      {/* Background ambient lighting */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full filter blur-[140px] opacity-10 transition-all duration-1000 pointer-events-none ${
        vadState === 'listening' ? 'bg-emerald-500' :
        vadState === 'speaking' ? 'bg-indigo-500' :
        vadState === 'processing' ? 'bg-amber-500' : 'bg-zinc-500'
      }`} />

      {/* Header */}
      <header className="glass border-b border-zinc-800/60 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/learn/demo" 
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">Kai Socratic Voice Console</span>
                <span className="badge-medium">Merge Sort Basics</span>
              </div>
              <span className="text-xs text-zinc-400">Option 1: Immersive Voice-First UI</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Turn progression */}
            <div className="flex flex-col items-end">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Session Turn Limit</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-black text-indigo-400">{turnCount} <span className="text-zinc-600">/ 20</span></span>
                <div className="w-20 h-1.5 rounded-full bg-zinc-850 overflow-hidden border border-zinc-800">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" 
                    style={{ width: `${(turnCount / 20) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white transition-all"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400 animate-pulse" /> : <Volume2 className="w-4 h-4 text-indigo-400" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Sandbox Grid */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
        
        {/* Left Column: Dialog Feed */}
        <section className="lg:col-span-7 flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
          <div className="flex items-center justify-between mb-4 shrink-0">
            <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-widest flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Conversational Log
            </h3>
            <span className="text-[11px] text-zinc-500">Click individual speech bubbles to play</span>
          </div>

          {/* Dialog Scroll Container */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mobile-scroll">
            {dialogue.map((bubble) => {
              const isKai = bubble.sender === 'kai';
              const isSelected = activeBubbleId === bubble.id;
              
              return (
                <div 
                  key={bubble.id} 
                  className={`flex w-full ${isKai ? 'justify-start bubble-in-left' : 'justify-end bubble-in-right'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl p-4 transition-all duration-300 relative border ${
                    isKai 
                      ? isSelected 
                        ? 'bg-indigo-950/40 border-indigo-500/40 text-zinc-100 shadow-[0_0_20px_rgba(99,102,241,0.05)]' 
                        : 'bg-zinc-950/60 border-zinc-900 text-zinc-200 hover:border-zinc-800'
                      : 'bg-zinc-900 border-zinc-800/80 text-zinc-100'
                  }`}>
                    {/* Speaker Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold uppercase tracking-wider ${
                          isKai ? 'text-indigo-400' : 'text-emerald-400'
                        }`}>
                          {isKai ? 'Kai' : 'You (Student)'}
                        </span>
                        {isKai && bubble.cognitiveCategory && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-[9px] font-semibold text-indigo-300 capitalize">
                            {bubble.cognitiveCategory} Focus
                          </span>
                        )}
                      </div>
                      
                      {bubble.duration && (
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <span>{bubble.duration}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-sm leading-relaxed text-zinc-300">
                      {bubble.text}
                    </p>

                    {/* Speech Actions inside bubble */}
                    {isKai && (
                      <div className="mt-3 pt-2.5 border-t border-zinc-900 flex justify-between items-center gap-4">
                        <button 
                          onClick={() => handlePlayBubble(bubble.id)}
                          className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
                            isSelected && vadState === 'speaking'
                              ? 'text-indigo-400'
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {isSelected && vadState === 'speaking' ? (
                            <>
                              <Volume2 className="w-3.5 h-3.5 animate-bounce" /> Speaking now
                            </>
                          ) : (
                            <>
                              <Play className="w-3 h-3" /> Replay Audio
                            </>
                          )}
                        </button>

                        {isSelected && (
                          <div className="flex gap-1 items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                            <span className="text-[10px] text-zinc-500 font-mono">Simulated Voice Node</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Sandbox Controls */}
          <div className="mt-4 pt-4 border-t border-zinc-900 flex gap-3 flex-wrap">
            <button 
              onClick={() => {
                if (turnCount < 20) setTurnCount(prev => prev + 1);
              }}
              className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition-all flex items-center gap-2"
            >
              Increment Turn Count
            </button>
            <button 
              onClick={() => setTurnCount(5)}
              className="px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-xs font-semibold text-zinc-400 hover:text-white transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Demo Turns
            </button>
          </div>
        </section>

        {/* Right Column: High Fidelity Cinematic VAD Rings & Waveform */}
        <section className="lg:col-span-5 flex flex-col justify-between items-center bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 relative overflow-hidden min-h-[500px]">
          {/* Glass background structure */}
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/5 to-transparent pointer-events-none" />
          
          <div className="w-full flex items-center justify-between shrink-0">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Live Voice Agent (VAD)</span>
            <button 
              onClick={() => setShowVADHelp(!showVADHelp)}
              className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {showVADHelp && (
            <div className="absolute top-16 left-6 right-6 z-20 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xl bubble-in-left">
              <h4 className="text-xs font-bold text-white mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Voice Activity Detection (VAD)
              </h4>
              <p className="text-[11px] text-zinc-400 leading-normal">
                VAD automatically senses your voice pauses. When you speak, the rings glow green. When Kai speaks, they glow indigo. Feel free to cycle the live state using the sandbox trigger button in the rings workspace!
              </p>
            </div>
          )}

          {/* VAD Ring Visualizer Hub */}
          <div className="relative flex items-center justify-center py-10 flex-1 w-full">
            
            {/* outer glowing aura */}
            <div 
              className={`absolute rounded-full filter blur-[40px] opacity-10 transition-all duration-700 ${
                vadState === 'listening' ? 'w-64 h-64 bg-emerald-500' :
                vadState === 'speaking' ? 'w-64 h-64 bg-indigo-500' :
                vadState === 'processing' ? 'w-64 h-64 bg-amber-500' : 'w-64 h-64 bg-zinc-700'
              }`} 
              style={{ transform: `scale(${breathingScale})` }}
            />

            {/* Breathing Ring 3 */}
            <div 
              className={`absolute rounded-full border transition-all duration-700 ${
                vadState === 'listening' ? 'w-48 h-48 border-emerald-500/20' :
                vadState === 'speaking' ? 'w-48 h-48 border-indigo-500/25' :
                vadState === 'processing' ? 'w-48 h-48 border-amber-500/20' : 'w-48 h-48 border-zinc-800'
              }`}
              style={{ transform: `scale(${breathingScale * 1.1})` }}
            />

            {/* Breathing Ring 2 */}
            <div 
              className={`absolute rounded-full border transition-all duration-500 ${
                vadState === 'listening' ? 'w-36 h-36 border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.1)]' :
                vadState === 'speaking' ? 'w-36 h-36 border-indigo-500/50 shadow-[0_0_25px_rgba(99,102,241,0.15)]' :
                vadState === 'processing' ? 'w-36 h-36 border-amber-500/45 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : 'w-36 h-36 border-zinc-800'
              }`}
              style={{ transform: `scale(${breathingScale * 1.05})` }}
            />

            {/* Main Interactive Mic Center Sphere */}
            <button 
              onClick={handleToggleState}
              className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-2 transition-all duration-500 z-10 ${
                vadState === 'listening' 
                  ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.25)] hover:bg-emerald-500/20' 
                  : vadState === 'speaking'
                  ? 'bg-indigo-500/10 border-indigo-400 text-indigo-400 shadow-[0_0_35px_rgba(99,102,241,0.25)] hover:bg-indigo-500/20'
                  : vadState === 'processing'
                  ? 'bg-amber-500/10 border-amber-400 text-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:bg-amber-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'
              }`}
            >
              {vadState === 'listening' ? (
                <>
                  <Mic className="w-8 h-8 animate-pulse mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400/80">Listening</span>
                </>
              ) : vadState === 'speaking' ? (
                <>
                  <Volume2 className="w-8 h-8 animate-bounce mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400/80">Kai Speaking</span>
                </>
              ) : vadState === 'processing' ? (
                <>
                  <Sparkles className="w-8 h-8 animate-spin mb-1 text-amber-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-400/80">Thinking</span>
                </>
              ) : (
                <>
                  <MicOff className="w-8 h-8 mb-1" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Muted</span>
                </>
              )}
            </button>
          </div>

          {/* Dynamic Waveform Visualizer simulation */}
          <div className="w-full shrink-0 space-y-4">
            
            {/* Waveform bars */}
            <div className="h-16 flex items-center justify-center gap-1.5 w-full bg-zinc-950/60 border border-zinc-900 rounded-2xl px-4 overflow-hidden">
              {Array.from({ length: 28 }).map((_, i) => {
                // Determine heights based on active simulated states
                let height = 4;
                if (vadState === 'speaking') {
                  const factor = Math.sin((i / 28) * Math.PI * 3 + Date.now() / 150);
                  height = Math.max(6, Math.abs(factor) * 50 + (i % 3 === 0 ? 10 : 0));
                } else if (vadState === 'listening') {
                  const factor = Math.cos((i / 28) * Math.PI * 2 + Date.now() / 300);
                  height = Math.max(6, Math.abs(factor) * 24 + 4);
                } else if (vadState === 'processing') {
                  height = 6 + (Math.sin((i + Date.now() / 100)) + 1) * 6;
                } else {
                  height = 4;
                }

                return (
                  <div 
                    key={i} 
                    className={`w-[3px] rounded-full transition-all duration-150 ${
                      vadState === 'listening' ? 'bg-emerald-500/60' :
                      vadState === 'speaking' ? 'bg-indigo-500/75 shadow-[0_0_10px_rgba(99,102,241,0.3)]' :
                      vadState === 'processing' ? 'bg-amber-500/50' : 'bg-zinc-800'
                    }`}
                    style={{ height: `${height}px` }}
                  />
                );
              })}
            </div>

            {/* Click to Cycle Demo Info */}
            <div className="text-center">
              <button 
                onClick={handleToggleState}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                Click mic or here to cycle state 
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="text-[10px] text-zinc-500 mt-1 flex justify-center gap-4">
                <span className={vadState === 'listening' ? 'text-emerald-400 font-bold' : ''}>1. Listening</span>
                <span className={vadState === 'speaking' ? 'text-indigo-400 font-bold' : ''}>2. Speaking</span>
                <span className={vadState === 'processing' ? 'text-amber-400 font-bold' : ''}>3. Thinking</span>
                <span className={vadState === 'idle' ? 'text-zinc-400 font-bold' : ''}>4. Idle</span>
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer Design System Specs overlay */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-3.5 text-xs text-zinc-500 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span className="font-mono text-[10px]">AlgoMind Console Option 1 - Dark Cinematic Glassmorphism</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-indigo-400" /> VAD React Syncing</span>
            <span className="flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Spring Mechanics</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
