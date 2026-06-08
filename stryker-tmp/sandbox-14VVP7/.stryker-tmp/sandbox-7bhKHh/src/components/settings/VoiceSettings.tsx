/**
 * @codesage
 * @file      src/components/settings/VoiceSettings.tsx
 * @purpose   Controls TTS engine selection and voice preferences for AI Interviewer.
 * @tech      React, TailwindCSS, Web Speech API
 * @connects  @/components/auth/AuthProvider, @/lib/supabase/user-preferences, lucide-react
 * @apis      None
 * @db        Supabase user_preferences (read/write)
 * @state     Local Component State
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Play, Volume2 } from 'lucide-react';
import { getUserPreferences, saveUserPreferences } from '@/lib/supabase/user-preferences';
import type { TTSProvider } from '@/lib/voice/tts-engine';

interface VoiceSettingsProps {
    inline?: boolean;
    ttsProvider?: TTSProvider | 'groq' | 'detecting';
    currentProvider?: 'groq' | 'browser' | 'polly';
}

//  -- automated unused local suppression
export function VoiceSettings({ inline, ttsProvider, currentProvider }: VoiceSettingsProps) {
    const { user } = useAuth();
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [rate, setRate] = useState<number>(1.1);
    const [ttsProviderChoice, setTtsProviderChoice] = useState<'auto' | 'polly' | 'browser'>('auto');
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);

    const isGroq = ttsProvider === 'groq' || currentProvider === 'groq';

    // Load available voices
    useEffect(() => {
        const loadVoices = () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                const allVoices = window.speechSynthesis.getVoices();

                const filtered = allVoices.filter(v =>
                    v.lang === 'en-US' ||
                    v.lang === 'en-GB' ||
                    v.lang === 'hi-IN'
                );

                const uniqueVoices = filtered.filter((v, index, self) =>
                    index === self.findIndex((t) => (
                        t.name === v.name
                    ))
                ).sort((a, b) => {
                    const getOrder = (lang: string) => {
                        if (lang === 'en-US') return 1;
                        if (lang === 'en-GB') return 2;
                        if (lang === 'hi-IN') return 3;
                        return 4;
                    };
                    return getOrder(a.lang) - getOrder(b.lang);
                });

                if (uniqueVoices.length < 5) {
                    const others = allVoices.filter(v =>
                        v.lang.startsWith('en') &&
                        !uniqueVoices.some(uv => uv.name === v.name)
                    );
                    others.forEach(v => {
                        if (uniqueVoices.length < 8 && !uniqueVoices.some(uv => uv.name === v.name)) {
                            uniqueVoices.push(v);
                        }
                    });
                }

                setVoices(uniqueVoices);
            }
        };

        loadVoices();

        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }

        return () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    // Load user preferences
    useEffect(() => {
        async function loadPrefs() {
            setLoading(true);
            try {
                const prefs = await getUserPreferences(user?.id || null);
                if (prefs.preferredVoiceName) {
                    setSelectedVoice(prefs.preferredVoiceName);
                } else {
                    const defaultVoice = voices.find(v => v.name.includes("Google US English") || v.lang === 'en-US');
                    if (defaultVoice) setSelectedVoice(defaultVoice.name);
                }
                setRate(prefs.voiceRate || 1.0);
                setTtsProviderChoice(prefs.ttsProvider ?? 'auto');
            } catch (e) {
                console.error("Failed to load voice preferences", e);
            } finally {
                setLoading(false);
            }
        }

        if (voices.length > 0) {
            loadPrefs();
        }
    }, [user, voices]);

    const handleSave = async () => {
        if (!selectedVoice) return;

        const voiceObj = voices.find(v => v.name === selectedVoice);

        try {
            await saveUserPreferences(user?.id || null, {
                preferredVoiceName: selectedVoice,
                preferredVoiceLang: voiceObj?.lang || 'en-US',
                voiceRate: rate,
                ttsProvider: ttsProviderChoice
            });
            toast.success("Voice settings saved!");
        } catch (e) {
            toast.error("Failed to save settings.");
        }
    };

    const handleTestVoice = () => {
        if (!selectedVoice || typeof window === 'undefined') return;

        window.speechSynthesis.cancel();

        const voiceObj = voices.find(v => v.name === selectedVoice);
        if (!voiceObj) return;

        const utterance = new SpeechSynthesisUtterance("Hello! This is how I will sound during your interview practice. Good luck!");
        utterance.voice = voiceObj;
        utterance.rate = rate;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        utterance.onerror = () => setIsPlaying(false);

        window.speechSynthesis.speak(utterance);
    };

    const handleRateChange = (vals: number[]) => {
        setRate(vals[0]);
    };

    if (loading && voices.length === 0) {
        return <div className="p-4 text-center text-zinc-500">Loading voice engine...</div>;
    }

    return (
        <div className="space-y-2 mb-8" data-tour="voice-capabilities">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600">
                AI Interviewer Voice
            </h2>
            <div className="rounded-2xl overflow-hidden p-5 space-y-6"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>

                {/* TTS Provider Status Badge */}
                <div className="space-y-2">
                    <label className="text-sm font-semibold text-zinc-200">TTS Provider</label>
                    <div className="flex items-center gap-3">
                        {ttsProvider === 'detecting' ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider bg-zinc-700/50 text-zinc-400 border border-zinc-600/50">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                Detecting...
                            </span>
                        ) : isGroq ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                Groq AI Voice
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider bg-zinc-700/50 text-zinc-400 border border-zinc-600/50">
                                <span className="w-2 h-2 rounded-full bg-zinc-400" />
                                Browser Voice
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                        {isGroq
                            ? 'Active voice: Aaliya (Indian English) — Groq Orpheus Neural TTS'
                            : `Active voice: ${selectedVoice || 'Default browser voice'}`
                        }
                    </p>
                </div>

                {/* TTS Provider Preference */}
                <div className="mt-4">
                    <label className="text-sm font-semibold text-zinc-200 block mb-2">
                        Voice Engine Preference
                    </label>
                    <div className="flex gap-2 relative">
                        {isGroq && (
                            <div className="absolute inset-0 z-10 cursor-not-allowed" title="Voice parameters are controlled by Groq during Groq calls." />
                        )}
                        {([
                            { value: 'auto', label: 'Auto', desc: 'Follow system setting' },
                            { value: 'polly', label: 'AWS Polly', desc: 'High quality, Indian English' },
                            { value: 'browser', label: 'Browser', desc: 'Built-in, always available' },
                        ] as const).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setTtsProviderChoice(opt.value)}
                                disabled={isGroq}
                                className={`flex-1 rounded-xl px-3 py-2.5 text-xs font-bold border transition-all text-left ${
                                    isGroq ? 'opacity-50' : ''
                                } ${
                                    ttsProviderChoice === opt.value
                                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                                        : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
                                }`}
                            >
                                <div>{opt.label}</div>
                                <div className="font-normal opacity-70 mt-0.5">{opt.desc}</div>
                            </button>
                        ))}
                    </div>
                    {ttsProviderChoice === 'polly' && !isGroq && (
                        <p className="text-xs text-amber-400/80 mt-2">
                            Polly only works when the global AWS Polly flag is enabled. Falls back to browser TTS if unavailable.
                        </p>
                    )}
                </div>

                {/* Voice Selection — dimmed when Groq is active */}
                <div className={`space-y-3 relative ${isGroq ? 'opacity-50' : ''}`}>
                    {isGroq && (
                        <div className="absolute inset-0 z-10 cursor-not-allowed" title="Browser voice is the fallback when Groq is unavailable" />
                    )}
                    <label className="text-sm font-semibold text-zinc-200">
                        Browser Voice Model
                        {isGroq && (
                            <span className="ml-2 text-[10px] text-zinc-500 font-normal">(fallback only)</span>
                        )}
                    </label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice} disabled={isGroq}>
                        <SelectTrigger className="w-full text-zinc-200" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }} disabled={voices.length === 0 || isGroq}>
                            <SelectValue placeholder={voices.length === 0 ? "Loading voices..." : "Select a voice"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}>
                            {voices.map((voice) => (
                                <SelectItem key={voice.name} value={voice.name} className="focus:bg-zinc-800 focus:text-white cursor-pointer text-zinc-300">
                                    <span className="flex items-center gap-2">
                                        {voice.name.replace(/Microsoft |Google /g, '')}
                                        <span className="text-[10px] text-zinc-500 ml-1 font-bold uppercase tracking-wider">{voice.lang}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {!isGroq && (
                        <p className="text-[11px] text-zinc-500">
                            Voice quality depends on your browser when using Browser mode
                        </p>
                    )}
                </div>

                {/* Speed Slider */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-semibold text-zinc-200">Speaking Rate</label>
                        <span className="text-[10px] font-black tracking-widest uppercase text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded">
                            {rate.toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        value={[rate]}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        onValueChange={handleRateChange}
                        className="py-4 [&_.bg-primary]:bg-indigo-500 [&_.bg-muted]:bg-indigo-500/20 [&_.border-input]:border-indigo-500/50"
                    />
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600 px-1">
                        <span>Slow</span>
                        <span>Normal</span>
                        <span>Fast</span>
                    </div>
                </div>


                {/* Actions */}
                <div className="flex gap-3 pt-2">
                    <Button
                        onClick={handleTestVoice}
                        variant="outline"
                        disabled={isPlaying}
                        className="flex-1 text-zinc-300 hover:text-white"
                        style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }}
                    >
                        {isPlaying ? (
                            <span className="animate-pulse flex items-center gap-2">
                                <Volume2 className="w-4 h-4" /> Speaking...
                            </span>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                Test Voice
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-1 btn-primary"
                    >
                        Save Settings
                    </Button>
                </div>
            </div>
        </div>
    );
}
