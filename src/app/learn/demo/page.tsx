'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  Mic, 
  Sliders, 
  Layers, 
  Volume2, 
  ArrowRight,
  Shield,
  Activity,
  Cpu,
  Brain
} from 'lucide-react';

export default function MainSelectorPage() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const options = [
    {
      id: 'option4',
      title: 'Option 4: Socratic Interactive Canvas',
      tagline: 'Recommended Redesign',
      path: '/learn/demo/option4',
      description: 'A premium, highly interactive single-column feed. Features dynamic inline concept highlighting with definitions on hover, premium thought cards, beautiful syntax-highlighted code, and an elegant floating bottom toolbar capsule.',
      highlights: [
        'Floating bottom toolbar capsule',
        'Breathing inline microphone pill with wave',
        'Gold/violet Socratic Thought Cards',
        'Soft inline concept definitions on hover'
      ],
      metrics: {
        immersion: 'Very High',
        distraction: 'None',
        density: 'Optimized',
        layout: 'Unified Column'
      },
      gradient: 'from-amber-400 via-indigo-500 to-emerald-500',
      icon: Sparkles
    },
    {
      id: 'option1',
      title: 'Option 1: Voice-First Console',
      tagline: 'Immersive Dark Cinematic',
      path: '/learn/demo/option1',
      description: 'A beautiful glassmorphic dark interface built around high-fidelity audio presence. Ideal for students who want a deeply engaging, low-distraction audio loop with real-time breathing visuals.',
      highlights: [
        'Glowing Breathing VAD Rings',
        'Immersive Speech Bubbles with replay actions',
        'Smooth CSS Waveform Visualizer',
        'Turn limit progression display (5 / 20)'
      ],
      metrics: {
        immersion: 'High',
        distraction: 'Very Low',
        density: 'Medium',
        layout: 'Centered Canvas'
      },
      gradient: 'from-indigo-600 via-purple-600 to-pink-600',
      icon: Mic
    },
    {
      id: 'option2',
      title: 'Option 2: Minimalist Studio Console',
      tagline: 'Flat High-Contrast Professional',
      path: '/learn/demo/option2',
      description: 'A clean, high-contrast dashboard reminiscent of professional audio editing workstations. Optimizes screen real estate for direct code/tutor focus with subtle indicators.',
      highlights: [
        'Circular percentage turn tracker',
        'Flat, high-contrast dashboard surfaces',
        'Clean vertical soundwave bars (CSS animated)',
        'Compact status-centric header grid'
      ],
      metrics: {
        immersion: 'Medium',
        distraction: 'Minimal',
        density: 'High',
        layout: 'Grid Dashboard'
      },
      gradient: 'from-emerald-500 via-teal-600 to-cyan-500',
      icon: Sliders
    },
    {
      id: 'option3',
      title: 'Option 3: Hybrid Split-Pane Console',
      tagline: 'Premium Split Layout',
      path: '/learn/demo/option3',
      description: 'A comprehensive layout that merges detailed problem metadata sidebars with a feature-rich, high-density conversational chat and audio feed. Perfect for complex DSA exercises.',
      highlights: [
        'Split-pane problem metadata panel',
        'Premium conversational speech bubbles',
        'Dual audio and text chat UI layout',
        'Compact sidebar cognitive focus indicators'
      ],
      metrics: {
        immersion: 'Balanced',
        distraction: 'Low',
        density: 'Very High',
        layout: 'Split-Pane'
      },
      gradient: 'from-amber-500 via-orange-600 to-red-500',
      icon: Layers
    }
  ];

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-hidden relative noise-overlay">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> UX Architecture Preview
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Kai Voice <span className="text-gradient">Console Options</span>
          </h1>
          
          <p className="text-zinc-400 text-base md:text-lg leading-relaxed">
            Welcome to the AlgoMind interactive design lab. Explore four distinct user experience paradigms crafted for voice-first DSA learning. Pick a direction to test the high-fidelity mockups.
          </p>
        </div>

        {/* Console Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <div 
                key={opt.id}
                className="group relative rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:border-zinc-700 hover:translate-y-[-4px] hover:shadow-[0_0_30px_rgba(99,102,241,0.08)]"
              >
                {/* Accent Background Glow */}
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${opt.gradient} opacity-0 group-hover:opacity-5 blur-[40px] transition-all duration-500`} />
                
                <div>
                  {/* Option Badge/Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className={`p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 group-hover:text-white group-hover:border-zinc-700 transition-colors`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                      {opt.tagline}
                    </span>
                  </div>

                  {/* Option Details */}
                  <h3 className="text-xl font-bold text-white mb-3 group-hover:text-zinc-100">
                    {opt.title}
                  </h3>
                  
                  <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                    {opt.description}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-2 mb-6">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block">Key Highlights</span>
                    <ul className="space-y-1.5">
                      {opt.highlights.map((h, i) => (
                        <li key={i} className="text-xs text-zinc-300 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-indigo-400" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* UX Profile Metrics */}
                  <div className="border-t border-zinc-900 pt-4 mb-8">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">UX Signature</span>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                      {Object.entries(opt.metrics).map(([key, val]) => (
                        <div key={key} className="flex justify-between items-center text-xs">
                          <span className="text-zinc-500 capitalize">{key}:</span>
                          <span className="text-zinc-300 font-medium">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Navigation Action */}
                <Link 
                  href={opt.path}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-200 group-hover:bg-indigo-600 group-hover:border-indigo-500 group-hover:text-white transition-all duration-300"
                >
                  Enter Mockup Preview
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            );
          })}
        </div>

        {/* Global Design System Information */}
        <div className="glass rounded-2xl p-6 border border-zinc-800/80 flex flex-col md:flex-row gap-6 justify-between items-center bg-zinc-950/40">
          <div className="space-y-2 max-w-2xl text-left">
            <h4 className="text-md font-bold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-400" /> AlgoMind UX Guidelines
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              These consoles use the standard styling tokens from <code className="text-indigo-300 font-mono text-[11px]">globals.css</code> including custom glassmorphic boundaries (<code className="text-indigo-300 font-mono text-[11px]">.glass</code>), difficulty indicators, speech bubble animation loops (<code className="text-indigo-300 font-mono text-[11px]">.bubble-in-left</code>), and high-fidelity simulated states.
            </p>
          </div>
          
          <div className="flex gap-4 items-center shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-400">
              <Shield className="w-3.5 h-3.5 text-indigo-400" /> Type-Safe Build
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-semibold text-zinc-400">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" /> Live Simulation
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
