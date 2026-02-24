/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mic, Play, Settings, Volume2 } from 'lucide-react';
import { getUserPreferences, saveUserPreferences } from '@/lib/supabase/user-preferences';

export function VoiceSettings({ inline }: { inline?: boolean }) {
    const { user } = useAuth();
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [rate, setRate] = useState<number>(1.1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [loading, setLoading] = useState(true);

    // Load available voices
    useEffect(() => {
        const loadVoices = () => {
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                const allVoices = window.speechSynthesis.getVoices();

                // Filter for US English, UK English, and Hindi (Indian English accent)
                // User Goal: 5+ options, mixed US, UK, and 1 Hindi accent
                const filtered = allVoices.filter(v =>
                    v.lang === 'en-US' ||
                    v.lang === 'en-GB' ||
                    v.lang === 'hi-IN'
                );

                // Deduplicate voices (remove similar ones like "Microsoft David Desktop" vs "Microsoft David")
                // Preference order: Google > Microsoft > System
                const uniqueVoices = filtered.filter((v, index, self) =>
                    index === self.findIndex((t) => (
                        t.name === v.name
                    ))
                ).sort((a, b) => {
                    // Sort order: US -> UK -> Hindi -> Others
                    const getOrder = (lang: string) => {
                        if (lang === 'en-US') return 1;
                        if (lang === 'en-GB') return 2;
                        if (lang === 'hi-IN') return 3;
                        return 4;
                    };
                    return getOrder(a.lang) - getOrder(b.lang);
                });

                // If we don't have enough (less than 5), add other English variants as backup
                if (uniqueVoices.length < 5) {
                    const others = allVoices.filter(v =>
                        v.lang.startsWith('en') &&
                        !uniqueVoices.some(uv => uv.name === v.name)
                    );
                    // Add distinct ones only
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
                    // Default to first English voice if none selected
                    const defaultVoice = voices.find(v => v.name.includes("Google US English") || v.lang === 'en-US');
                    if (defaultVoice) setSelectedVoice(defaultVoice.name);
                }
                setRate(prefs.voiceRate || 1.0);
            } catch (e) {
                console.error("Failed to load voice preferences", e);
            } finally {
                setLoading(false);
            }
        }

        // Only load if voices are ready
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
                voiceRate: rate
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
        return <div className="p-4 text-center text-slate-500">Loading voice engine...</div>;
    }

    return (
        <div className="space-y-2 mb-8" data-tour="voice-capabilities">
            <h2 className="text-xs font-black uppercase tracking-widest text-zinc-600">
                AI Interviewer Voice
            </h2>
            <div className="rounded-2xl overflow-hidden p-5 space-y-6"
                style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
                {/* Voice Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-semibold text-zinc-200">AI Voice Model</label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="w-full text-zinc-200" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge)' }} disabled={voices.length === 0}>
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
