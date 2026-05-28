'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Sliders, 
  Volume2, 
  VolumeX, 
  Activity, 
  Clock, 
  CheckCircle,
  HelpCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Settings2
} from 'lucide-react';

interface LogItem {
  id: string;
  speaker: 'Kai' | 'Learner';
  timestamp: string;
  message: string;
  highlighted?: boolean;
}

export default function Option2MinimalistStudio() {
  const [turnValue, setTurnValue] = useState(12);
  const maxTurns = 20;
  const turnPercentage = (turnValue / maxTurns) * 100;
  const strokeDashoffset = 113 - (113 * turnPercentage) / 100; // Radius = 18, circumference = 2 * PI * 18 ≈ 113

  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [visualizerStyle, setVisualizerStyle] = useState<'discrete' | 'solid'>('discrete');
  const [isPlaying, setIsPlaying] = useState(true);

  const [chatLogs, setChatLogs] = useState<LogItem[]>([
    {
      id: '1',
      speaker: 'Kai',
      timestamp: '10:04:12 AM',
      message: 'Let us dive into binary tree traversal. When implementing a Depth-First Search (DFS), what data structure implicitly manages our program execution recursion stack?',
      highlighted: true
    },
    {
      id: '2',
      speaker: 'Learner',
      timestamp: '10:04:30 AM',
      message: 'It is the system execution stack! Every time we call recursive pre-order, the arguments and return address are pushed onto the call stack.'
    },
    {
      id: '3',
      speaker: 'Kai',
      timestamp: '10:05:02 AM',
      message: 'Perfect explanation of the call stack! Now, what if we wanted to implement an iterative DFS instead? Which explicit data structure should we instantiate to replicate this stack behavior?'
    },
    {
      id: '4',
      speaker: 'Learner',
      timestamp: '10:05:24 AM',
      message: 'We can use an explicit Stack container, like a standard list or array. We push the root node, and then pop elements in a loop while pushing their right and left children.'
    }
  ]);

  const handleToggleHighlight = (id: string) => {
    setChatLogs(prev => prev.map(log => 
      log.id === id ? { ...log, highlighted: !log.highlighted } : log
    ));
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-zinc-100 flex flex-col justify-between overflow-x-hidden relative">
      
      {/* Flat dashboard header */}
      <header className="bg-[#121218] border-b border-zinc-800/80 sticky top-0 z-30 px-6 py-3.5">
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
                <span className="text-sm font-bold text-white tracking-wide">Kai Studio Console</span>
                <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-700/60 rounded">
                  Studio Focus
                </span>
              </div>
              <span className="text-xs text-zinc-500">Option 2: Minimalist High-Contrast Dashboard</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="hidden md:flex items-center gap-6 text-xs text-zinc-400 border-l border-r border-zinc-800 px-6 py-1">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>VAD Latency: <strong className="text-white">85ms</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Decoder: <strong className="text-white">Opus 24kHz</strong></span>
            </div>
          </div>

          {/* Turn Circle percentage tracker */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end justify-center">
              <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Turn progression</span>
              <span className="text-xs text-zinc-300 font-semibold">{turnValue} of {maxTurns} remaining</span>
            </div>
            
            {/* SVG circular progress */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  className="stroke-zinc-800 fill-none"
                  strokeWidth="2.5"
                />
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  className="stroke-indigo-500 fill-none transition-all duration-300"
                  strokeWidth="2.5"
                  strokeDasharray="113"
                  strokeDashoffset={strokeDashoffset}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                {Math.round(turnPercentage)}%
              </div>
            </div>
          </div>

        </div>
      </header>

      {/* Main content grid */}
      <main className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10 items-stretch">
        
        {/* Left Column: Compact Dialogue Grid */}
        <section className="lg:col-span-8 flex flex-col justify-between h-[calc(100vh-220px)] min-h-[500px]">
          
          <div className="flex items-center justify-between mb-4 shrink-0">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-zinc-400" />
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Console Dialogue Log</span>
            </div>
            <span className="text-[11px] text-zinc-500">Tap bubbles to toggle text high-contrast review mode</span>
          </div>

          {/* Compact Studio Message Feed */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 custom-scrollbar mobile-scroll">
            {chatLogs.map((log) => {
              const isKai = log.speaker === 'Kai';
              return (
                <div 
                  key={log.id}
                  onClick={() => handleToggleHighlight(log.id)}
                  className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 ${
                    log.highlighted 
                      ? 'bg-zinc-900 border-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.06)]' 
                      : 'bg-[#121218] border-zinc-800/80 hover:border-zinc-700/80'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${
                        isKai ? 'text-indigo-400' : 'text-zinc-400'
                      }`}>
                        {log.speaker} Socratic Node
                      </span>
                      <span className="w-1 h-1 rounded-full bg-zinc-800" />
                      <span className="text-[10px] text-zinc-500 font-mono">{log.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                      {log.highlighted ? (
                        <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-1.5 py-0.5 rounded">Active High-Contrast</span>
                      ) : (
                        <span className="text-[9px] font-medium text-zinc-600">Review Mode</span>
                      )}
                    </div>
                  </div>

                  <p className={`text-sm leading-relaxed ${
                    log.highlighted ? 'text-white font-medium' : 'text-zinc-400'
                  }`}>
                    {log.message}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Sandbox controls for testing turns */}
          <div className="mt-4 pt-4 border-t border-zinc-800/60 flex items-center justify-between flex-wrap gap-4 shrink-0">
            
            {/* Interactive Slider */}
            <div className="flex items-center gap-4 flex-1 min-w-[240px]">
              <span className="text-xs text-zinc-500 font-medium shrink-0">Simulate Turns:</span>
              <input 
                type="range"
                min="0"
                max={maxTurns}
                value={turnValue}
                onChange={(e) => setTurnValue(parseInt(e.target.value))}
                className="w-full h-1.5 rounded bg-zinc-800 accent-indigo-500 cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-white shrink-0">{turnValue} / 20</span>
            </div>

            <button 
              onClick={() => setTurnValue(12)}
              className="px-3.5 py-2 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Turns
            </button>
          </div>

        </section>

        {/* Right Column: Flat Soundwave Bars */}
        <section className="lg:col-span-4 flex flex-col justify-between bg-[#121218] border border-zinc-800/80 rounded-2xl p-5 min-h-[500px]">
          
          <div className="space-y-4 w-full">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-zinc-500" /> Studio Controls
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {/* Playback speed selector */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Speech Speed Override</span>
              <div className="grid grid-cols-4 gap-2">
                {([1, 1.25, 1.5, 2] as const).map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      playbackSpeed === speed
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Visualizer selector */}
            <div className="space-y-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Visualizer Wave Style</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setVisualizerStyle('discrete')}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    visualizerStyle === 'discrete'
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                  }`}
                >
                  Discrete Bands
                </button>
                <button
                  onClick={() => setVisualizerStyle('solid')}
                  className={`py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                    visualizerStyle === 'solid'
                      ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white'
                  }`}
                >
                  Solid Block
                </button>
              </div>
            </div>
          </div>

          {/* Studio Audio Signal simulation container */}
          <div className="py-8 flex flex-col items-center justify-center flex-1 w-full relative">
            
            {/* Studio Waveform Bars */}
            <div className="flex items-end justify-center gap-1 w-full h-32 px-4 overflow-hidden relative">
              {Array.from({ length: 16 }).map((_, i) => {
                // Generate CSS keyframe simulation
                const delay = i * 0.12;
                return (
                  <div
                    key={i}
                    className={`w-[6px] rounded-t-sm transition-all duration-300 ${
                      isPlaying 
                        ? 'bg-gradient-to-t from-indigo-600 to-indigo-400' 
                        : 'bg-zinc-800'
                    }`}
                    style={{
                      height: isPlaying ? '100%' : '4px',
                      maxHeight: isPlaying ? '90px' : '4px',
                      animation: isPlaying ? `studio-wave 1.6s ease-in-out infinite alternate` : 'none',
                      animationDelay: `${delay}s`
                    }}
                  />
                );
              })}

              {/* CSS Animation embedded in styling */}
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes studio-wave {
                  0% { transform: scaleY(0.1); }
                  50% { transform: scaleY(1); }
                  100% { transform: scaleY(0.3); }
                }
              `}} />
            </div>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  isPlaying 
                    ? 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-850'
                    : 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.25)]'
                }`}
              >
                {isPlaying ? 'Pause Signal' : 'Resume Signal'}
              </button>

              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-zinc-300" />}
              </button>
            </div>
          </div>

          <div className="bg-zinc-900/60 rounded-xl p-3.5 border border-zinc-850 shrink-0">
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold block mb-1">Studio Status</span>
            <div className="flex justify-between items-center text-xs text-zinc-400">
              <span>Decoder Signal:</span>
              <span className="font-mono text-emerald-400 font-semibold">ONLINE</span>
            </div>
          </div>

        </section>

      </main>

      {/* Footer System Specs */}
      <footer className="bg-[#121218] border-t border-zinc-850 px-6 py-3.5 text-xs text-zinc-500 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span className="font-mono text-[10px]">AlgoMind Console Option 2 - Minimalist Studio Dashboard</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Sliders className="w-3.5 h-3.5 text-zinc-400" /> CSS keyframes</span>
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-indigo-400" /> SVGs dynamic math</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
