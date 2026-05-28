'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ArrowLeft, Play, RefreshCw, Volume2, Mic, MicOff, 
  Send, Keyboard, HelpCircle, Code2, BookOpen, Clock, Lightbulb, CheckCircle2, ChevronRight
} from 'lucide-react';

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  type?: 'thought' | 'standard';
  code?: string;
  highlights?: Array<{ word: string; definition: string; color: 'indigo' | 'emerald' | 'amber' | 'blue' }>;
}

export default function Option4Demo() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [hoveredConcept, setHoveredConcept] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      type: 'thought',
      content: "Hello! Welcome to your learning session on Arrays & Strings. I'm Kai, your Socratic tutor. Today we are exploring the classic Two-Sum problem. Let's calibrate: if you were handed an array of numbers and asked to find two indices that add up to a target sum, how would you approach it in the simplest way possible? Don't worry about efficiency yet—just talk me through your initial thoughts!",
      highlights: [
        { word: 'Two-Sum', definition: 'Find two numbers in an array that add up to a specific target sum.', color: 'indigo' },
        { word: 'simplest way possible', definition: 'Also known as the brute force approach; straightforward but usually slower.', color: 'blue' }
      ]
    },
    {
      id: '2',
      role: 'user',
      content: "We can just use nested loops. The outer loop selects a number, and the inner loop checks all the numbers after it to see if they sum up to the target. If they do, we return their indices."
    },
    {
      id: '3',
      role: 'assistant',
      content: "Spot on! That nested loop strategy is perfectly correct. It explores all possible pairs, which is a great baseline. Let's analyze its performance. If our array grows to contain 10,000 numbers, how does the number of operations scale with respect to the input size N? What is the Time Complexity of this brute force approach?",
      highlights: [
        { word: 'Time Complexity', definition: 'How the execution time of an algorithm scales as the input size grows.', color: 'amber' },
        { word: 'brute force', definition: 'A straightforward approach that solves a problem by searching all possibilities.', color: 'blue' }
      ]
    },
    {
      id: '4',
      role: 'user',
      content: "Since we check every pair, it takes N squared operations, so the time complexity is O(N^2)."
    },
    {
      id: '5',
      role: 'assistant',
      type: 'thought',
      content: "Exactly! O(N^2) complexity. If N is 10,000, that's up to 100,000,000 operations! Now, let's put on our optimizer hats. If we want to achieve an optimal Time Complexity of O(N), we must find a way to complete our check in a single pass. Imagine you are walking through the array. What helper registry or lookup tool could you carry with you to remember the complement values of numbers you have already scanned, allowing you to find a match in constant O(1) time?",
      highlights: [
        { word: 'O(N^2) complexity', definition: 'Quadratic time. If input grows 10x, operations grow 100x. Very slow for large inputs.', color: 'amber' },
        { word: 'O(N)', definition: 'Linear time. Operations scale 1:1 with input size. Highly optimal.', color: 'emerald' },
        { word: 'O(1) time', definition: 'Constant time. Lookup takes the same time regardless of how large the data structure is.', color: 'emerald' }
      ]
    },
    {
      id: '6',
      role: 'user',
      content: "We can use a Hash Map to store the numbers we've seen so far. For each number, we check if its complement (target - current) is already in the map."
    },
    {
      id: '7',
      role: 'assistant',
      content: "Phenomenal! That is the absolute optimal way. Here is what your elegant O(N) Hash Map solution looks like in Python. Observe how we perform our complement lookup in a single sweep:",
      code: `def twoSum(nums, target):\n    seen = {} # val -> index\n    for i, num in enumerate(nums):\n        complement = target - num\n        # >>> CRITICAL LINE: constant O(1) registry check\n        if complement in seen:\n            return [seen[complement], i]\n        seen[num] = i\n    return []`,
      highlights: [
        { word: 'Hash Map', definition: 'A key-value lookup data structure that resolves keys in O(1) average time.', color: 'indigo' },
        { word: 'complement', definition: 'The value needed to reach target sum, calculated as target - current_value.', color: 'blue' }
      ]
    }
  ]);

  const handleSend = () => {
    if (!textInput.trim()) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', content: textInput }
    ]);
    setTextInput('');
  };

  const getHighlightClass = (color: string) => {
    switch (color) {
      case 'indigo': return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20';
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20';
      case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20';
    }
  };

  const renderContentWithHighlights = (msg: Message) => {
    if (!msg.highlights) return <span>{msg.content}</span>;

    let text = msg.content;
    const words = msg.highlights.map(h => h.word);
    const regex = new RegExp(`(${words.map(w => w.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
    const parts = text.split(regex);

    return parts.map((part, i) => {
      const highlight = msg.highlights?.find(h => h.word.toLowerCase() === part.toLowerCase());
      if (highlight) {
        return (
          <span
            key={i}
            onMouseEnter={() => {
              setHoveredConcept(highlight.word);
              setTooltipContent(highlight.definition);
            }}
            onMouseLeave={() => {
              setHoveredConcept(null);
              setTooltipContent(null);
            }}
            className={`cursor-help px-2 py-0.5 rounded-md border text-xs font-semibold inline-block transition-all ${getHighlightClass(highlight.color)}`}
          >
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  if (!mounted) return null;

  return (
    <div className="h-screen bg-[#07070B] flex flex-col relative overflow-hidden noise-overlay"
      style={{
        backgroundImage: `
          radial-gradient(at 15% 15%, rgba(99, 102, 241, 0.06) 0px, transparent 35%),
          radial-gradient(at 85% 85%, rgba(139, 92, 246, 0.06) 0px, transparent 35%),
          linear-gradient(rgba(255, 255, 255, 0.007) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.007) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 100% 100%, 36px 36px, 36px 36px'
      }}
    >
      {/* Header */}
      <header className="flex-shrink-0 bg-[#07070B]/85 backdrop-blur-md border-b border-[#1E1E2E]/40 px-6 py-4 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <Link href="/learn/demo" className="p-2 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Learn Demo</span>
              <span>/</span>
              <span className="text-zinc-300">Option 4</span>
            </div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              Socratic Interactive Canvas
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Turn Progress bar */}
          <div className="flex items-center gap-2.5 bg-zinc-900/40 border border-white/5 px-3.5 py-1.5 rounded-full">
            <span className="text-xs font-semibold text-zinc-400">Exchange 5 / 20</span>
            <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 w-1/4 rounded-full" />
            </div>
          </div>
          {/* Mode Toggle */}
          <div className="flex bg-zinc-950/80 border border-white/10 rounded-lg p-1">
            <button
              onClick={() => setIsVoiceMode(true)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                isVoiceMode ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Mic size={12} /> Voice
            </button>
            <button
              onClick={() => {
                setIsVoiceMode(false);
                setIsListening(false);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                !isVoiceMode ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Keyboard size={12} /> Text
            </button>
          </div>
        </div>
      </header>

      {/* Main Centered Content Feed (S-Curve Conversation Layout, clean widths, responsive grids) */}
      <main className="flex-1 overflow-y-auto px-6 py-8 space-y-6 z-10">
        <div className="max-w-6xl mx-auto w-full space-y-8 pb-24">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isKai = msg.role === 'assistant';
              const isThought = msg.type === 'thought';

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Kai Avatar on Left */}
                  {isKai && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 relative bg-indigo-950 border border-indigo-500/20 text-indigo-400 shadow-md">
                      K
                      {isPlayingAudio && (
                        <span className="absolute inset-0 rounded-full border border-indigo-400 animate-ping opacity-60" />
                      )}
                    </div>
                  )}

                  {/* Socratic Thought Card or Standard Bubble with 70% Max Width Limit */}
                  <div className={`space-y-3 max-w-[70%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                    <div
                      className={`rounded-2xl px-5 py-4 text-sm leading-relaxed border transition-all text-left ${
                        isThought
                          ? 'bg-[#12121D]/90 border-amber-500/10 text-zinc-200 shadow-md relative overflow-hidden'
                          : isKai
                            ? 'bg-[#12121A] border-[#1E1E2E]/20 text-zinc-200'
                            : 'bg-indigo-600/10 border-indigo-500/15 text-zinc-200 ml-auto'
                      }`}
                    >
                      {isThought && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-2">
                          <Lightbulb size={12} className="shrink-0" />
                          Socratic Guidance
                        </div>
                      )}
                      
                      <p>{renderContentWithHighlights(msg)}</p>

                      {isKai && (
                        <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-2.5">
                          <button 
                            onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-950/40 px-2.5 py-1 rounded-md border border-indigo-500/10"
                          >
                            <Volume2 size={12} />
                            {isPlayingAudio ? 'Pause Speech' : 'Listen'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Code Card Rendering (Left aligned inside bubble context) */}
                    {msg.code && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.99 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-[#0E0E14] font-mono text-xs text-zinc-300 shadow-black/40 text-left"
                      >
                        <div className="bg-zinc-950/60 px-4 py-2 border-b border-white/5 flex items-center justify-between">
                          <span className="text-zinc-500 flex items-center gap-1.5">
                            <Code2 size={12} /> Python Optimal Solution
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                            O(N) Sweep
                          </span>
                        </div>
                        <div className="p-4 overflow-x-auto leading-relaxed relative">
                          {msg.code.split('\n').map((line, idx) => {
                            const isCritical = line.includes('>>>');
                            const cleanLine = line.replace('# >>> ', '');
                            return (
                              <div 
                                key={idx} 
                                className={`flex px-2 py-0.5 rounded ${
                                  isCritical 
                                    ? 'bg-emerald-500/10 border-l-2 border-emerald-500 text-emerald-300 font-semibold my-1' 
                                    : ''
                                }`}
                              >
                                <span className="w-6 text-zinc-600 select-none text-right mr-4">{idx + 1}</span>
                                <span>{cleanLine}</span>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* User Avatar on Right */}
                  {!isKai && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-zinc-800 border border-zinc-700/50 text-zinc-300">
                      U
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating Concept Tooltip Box */}
      <AnimatePresence>
        {tooltipContent && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full bg-[#161622] border border-white/10 rounded-xl p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex gap-2 items-start">
              <BookOpen size={16} className="text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-white mb-1">Concept: {hoveredConcept}</h4>
                <p className="text-xs text-zinc-400 leading-normal">{tooltipContent}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Sticky Footer Console */}
      <footer className="flex-shrink-0 bg-[#07070B]/95 backdrop-blur-md border-t border-[#1E1E2E]/40 px-6 py-4 safe-area-bottom z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 w-full">
          
          {isVoiceMode ? (
            <div className="flex items-center gap-3 w-full justify-between">
              {/* Voice Status pill */}
              <div className="flex items-center gap-2 text-zinc-500 text-xs">
                <span className="text-[10px] uppercase font-bold tracking-wider select-none">Kai is Listening</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>

              {/* Centered breathing Mic Pill */}
              <button
                onClick={() => setIsListening(!isListening)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full font-bold text-xs transition-all relative overflow-hidden shrink-0 mx-auto ${
                  isListening
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/5'
                }`}
              >
                {isListening && (
                  <motion.span
                    className="absolute inset-0 bg-emerald-500/30 rounded-full"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                )}
                {isListening ? <Mic size={14} className="animate-pulse" /> : <MicOff size={14} />}
                <span>{isListening ? 'Listening... Tap to Stop' : 'Tap to Speak'}</span>
                
                {isListening && (
                  <div className="flex gap-0.5 items-center justify-center shrink-0 ml-1">
                    {[0.3, 0.6, 0.4, 0.8, 0.3].map((height, i) => (
                      <motion.div
                        key={i}
                        className="w-0.5 bg-white rounded-full"
                        animate={{ height: ['4px', `${12 * height}px`, '4px'] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                      />
                    ))}
                  </div>
                )}
              </button>

              <div className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider select-none shrink-0">
                Voice Mode Active
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              {/* Text Input area at the bottom */}
              <div className="flex-1 bg-[#12121A] border border-white/5 rounded-xl flex items-center px-4 py-1.5 focus-within:border-indigo-500/30 transition-colors">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Type your DSA answer here..."
                  className="flex-1 bg-transparent border-0 text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-0 py-1"
                />
                <button
                  onClick={handleSend}
                  disabled={!textInput.trim()}
                  className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white transition-colors ml-2 shrink-0"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          )}

        </div>
      </footer>
    </div>
  );
}
