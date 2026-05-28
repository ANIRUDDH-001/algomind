'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Layers, 
  HelpCircle, 
  Play, 
  BookOpen, 
  Code2, 
  Send,
  Mic,
  Cpu,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award
} from 'lucide-react';

interface DialogueBubble {
  id: string;
  sender: 'kai' | 'student';
  message: string;
  timestamp: string;
  isAudio?: boolean;
}

export default function Option3HybridConsole() {
  const [dialogue, setDialogue] = useState<DialogueBubble[]>([
    {
      id: '1',
      sender: 'kai',
      message: 'Greetings! Today we explore the Merge Sort sorting algorithm. It operates on the classic divide-and-conquer strategy. Let us first review the partition stage. How does it break down the initial array of elements?',
      timestamp: '09:12 AM',
      isAudio: true
    },
    {
      id: '2',
      sender: 'student',
      message: 'We split the array in half recursively until we have sub-arrays of size 1. Those are trivially sorted, and then we begin merging them back up.',
      timestamp: '09:13 AM'
    },
    {
      id: '3',
      sender: 'kai',
      message: 'Exactly! Dividing the problem takes constant time at each step. Now, consider the merging phase. When combining two sorted sub-arrays of combined size N, what is the maximum number of comparisons we need to perform in the worst case?',
      timestamp: '09:14 AM',
      isAudio: true
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [codeExpanded, setCodeExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'cognitive'>('details');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newStudentMessage: DialogueBubble = {
      id: Date.now().toString(),
      sender: 'student',
      message: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setDialogue(prev => [...prev, newStudentMessage]);
    setInputText('');

    // Simulate Kai typing back
    setTimeout(() => {
      const newKaiResponse: DialogueBubble = {
        id: (Date.now() + 1).toString(),
        sender: 'kai',
        message: "That's an insightful perspective! To add to that, in the worst case we compare N - 1 elements during the merge process. This is why the merge step runs in O(N) time. Shall we write the formal recurrence relation for this algorithm?",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAudio: true
      };
      setDialogue(prev => [...prev, newKaiResponse]);
    }, 1500);
  };

  const handleToggleRecord = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      // Simulate speaking pause after 3 seconds
      setTimeout(() => {
        setIsRecording(false);
        const voiceMockMessage: DialogueBubble = {
          id: Date.now().toString(),
          sender: 'student',
          message: 'I believe the worst case comparisons would be N - 1 because the last element doesn’t need a comparison once the other side is empty.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setDialogue(prev => [...prev, voiceMockMessage]);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090d] text-zinc-100 flex flex-col justify-between overflow-x-hidden relative noise-overlay">
      
      {/* Header */}
      <header className="glass border-b border-zinc-900 sticky top-0 z-30 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/learn/demo" 
              className="p-2 rounded-lg bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">Kai Hybrid Console</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400">
                  Dual Layout
                </span>
              </div>
              <span className="text-xs text-zinc-500">Option 3: High Density Sidebar Split-Pane</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-900 text-xs text-zinc-400">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Turn Index: <strong>6 / 20</strong></span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Sandbox split grid */}
      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
        
        {/* Left Column: Sidebar Problem Metadata & Code Workspace (Col span 4) */}
        <section className="lg:col-span-4 flex flex-col gap-6 h-[calc(100vh-220px)] min-h-[500px] overflow-y-auto custom-scrollbar pr-1">
          
          {/* Metadata Selector Tabs */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-2.5 flex gap-2">
            <button
              onClick={() => setActiveTab('details')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'details'
                  ? 'bg-zinc-900 text-white border border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Problem Info
            </button>
            <button
              onClick={() => setActiveTab('cognitive')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === 'cognitive'
                  ? 'bg-zinc-900 text-white border border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Cognitive Focus
            </button>
          </div>

          {activeTab === 'details' ? (
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <span className="badge-medium">Recursion & Sorting</span>
                <span className="text-[11px] text-zinc-500 font-mono">ID: DSA-1042</span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white mb-1.5">Merge Sort Time Complexity</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Analyze the recurrence relation <code className="text-indigo-400 font-mono text-[11px]">T(N) = 2T(N/2) + O(N)</code> to understand why Merge Sort exhibits an O(N log N) worst-case time complexity.
                </p>
              </div>

              <div className="border-t border-zinc-900 pt-4 space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Input array constraint:</span>
                  <span className="text-zinc-300 font-mono">1 &le; N &le; 10^5</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500">Space complexity target:</span>
                  <span className="text-zinc-300 font-mono">O(N) aux space</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-5 space-y-4">
              <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-400" /> Skill Calibration
              </span>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Decomposition:</span>
                    <span className="text-indigo-400 font-bold">85%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: '85%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Optimization:</span>
                    <span className="text-emerald-400 font-bold">70%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: '70%' }} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Complexity Evaluation:</span>
                    <span className="text-amber-400 font-bold">95%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: '95%' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsible DSA reference implementation workspace */}
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl overflow-hidden flex flex-col">
            <button 
              onClick={() => setCodeExpanded(!codeExpanded)}
              className="px-5 py-4 flex items-center justify-between text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-400" />
                Algorithm Reference Snippet
              </span>
              {codeExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {codeExpanded && (
              <div className="p-4 bg-zinc-950 border-t border-zinc-900 text-[11px] font-mono text-zinc-300 overflow-x-auto leading-relaxed">
                <pre>{`void mergeSort(int arr[], int l, int r) {
  if (l < r) {
    // Find the middle point
    int m = l + (r - l) / 2;

    // Sort first and second halves
    mergeSort(arr, l, m);
    mergeSort(arr, m + 1, r);

    // Merge the sorted halves
    merge(arr, l, m, r);
  }
}`}</pre>
              </div>
            )}
          </div>

          <div className="mt-auto p-4 rounded-xl bg-zinc-950 border border-zinc-900 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Need a hint? Ask Kai for one.</span>
            <button 
              onClick={() => {
                const hintMessage: DialogueBubble = {
                  id: Date.now().toString(),
                  sender: 'kai',
                  message: 'Hint: Remember that dividing the array halves the input size, while the merge function processes all elements in a single pass.',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  isAudio: true
                };
                setDialogue(prev => [...prev, hintMessage]);
              }}
              className="text-indigo-400 hover:text-indigo-300 font-bold"
            >
              Get Hint
            </button>
          </div>

        </section>

        {/* Right Column: Dialogue Feed & Interactive Input (Col span 8) */}
        <section className="lg:col-span-8 flex flex-col justify-between bg-zinc-950/40 border border-zinc-900 rounded-3xl p-6 h-[calc(100vh-220px)] min-h-[500px]">
          
          {/* Conversational log */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar mb-4 mobile-scroll">
            {dialogue.map((bubble) => {
              const isKai = bubble.sender === 'kai';
              return (
                <div 
                  key={bubble.id}
                  className={`flex w-full ${isKai ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] rounded-2xl p-4 border transition-all ${
                    isKai 
                      ? 'bg-zinc-950 border-zinc-900 text-zinc-100' 
                      : 'bg-indigo-950/40 border-indigo-500/20 text-zinc-100'
                  }`}>
                    <div className="flex items-center justify-between gap-6 mb-1.5">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${
                        isKai ? 'text-indigo-400' : 'text-emerald-400'
                      }`}>
                        {isKai ? 'Kai' : 'You (Student)'}
                      </span>
                      <span className="text-[9px] text-zinc-600 font-mono">{bubble.timestamp}</span>
                    </div>

                    <p className="text-sm leading-relaxed text-zinc-300">
                      {bubble.message}
                    </p>

                    {isKai && bubble.isAudio && (
                      <div className="mt-2.5 pt-2 border-t border-zinc-900 flex justify-between items-center">
                        <button className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-500 hover:text-zinc-300">
                          <Play className="w-3 h-3" /> Replay Vocal Output
                        </button>
                        <span className="text-[9px] text-zinc-600">Premium TTS</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Chat Input Area */}
          <form onSubmit={handleSendMessage} className="space-y-4 border-t border-zinc-900 pt-4 shrink-0">
            
            {/* Record / Status indicator */}
            {isRecording && (
              <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 bubble-in-left">
                <div className="flex items-center gap-2 text-emerald-400 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Recording voice input... speak DSA terms clearly.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecording(false)}
                  className="text-[10px] uppercase font-bold text-red-400 hover:text-red-300"
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleToggleRecord}
                className={`p-3.5 rounded-xl border transition-all ${
                  isRecording 
                    ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
                title="Mock Mic Input"
              >
                <Mic className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isRecording ? 'Listening for speech...' : 'Type DSA answer here or click mic to dictate...'}
                disabled={isRecording}
                className="flex-1 px-4 py-3 rounded-xl bg-zinc-950 border border-zinc-900 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-3.5 rounded-xl text-white transition-all ${
                  inputText.trim()
                    ? 'bg-indigo-600 hover:bg-indigo-500 hover:translate-y-[-1px]'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between items-center text-[10px] text-zinc-500">
              <span>Tip: Hit Send or press Enter to trigger a simulated Kai reply.</span>
              <span>Input Mode: Audio Dictation + Text Hybrid</span>
            </div>
          </form>

        </section>

      </main>

      {/* Footer System Specs */}
      <footer className="bg-zinc-950 border-t border-zinc-900 px-6 py-3.5 text-xs text-zinc-500 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span className="font-mono text-[10px]">AlgoMind Console Option 3 - Hybrid Sidebar Split-Pane</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-zinc-400" /> Split Panel Sync</span>
            <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5 text-indigo-400" /> Audio Node Calibration</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
