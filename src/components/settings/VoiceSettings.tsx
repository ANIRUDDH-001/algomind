'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Mic, Play, Settings, Volume2 } from 'lucide-react';
import { getUserPreferences, saveUserPreferences } from '@/lib/supabase/user-preferences';

export function VoiceSettings() {
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
        <Card className="bg-slate-900/50 border-slate-800" data-tour="voice-capabilities">
            <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Voice Capabilities
                </CardTitle>
                <CardDescription>Customize the AI interviewer's voice and speed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Voice Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-300">AI Voice</label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                        <SelectTrigger className="w-full bg-slate-800/50 border-slate-700 text-white" disabled={voices.length === 0}>
                            <SelectValue placeholder={voices.length === 0 ? "Loading voices..." : "Select a voice"} />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px] bg-slate-900 border-slate-700 text-slate-200">
                            {voices.map((voice) => (
                                <SelectItem key={voice.name} value={voice.name} className="focus:bg-slate-800 focus:text-white cursor-pointer">
                                    <span className="flex items-center gap-2">
                                        {voice.name.replace(/Microsoft |Google /g, '')}
                                        <span className="text-xs text-slate-500 ml-1">({voice.lang})</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Speed Slider */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-slate-300">Speaking Rate</label>
                        <span className="text-xs font-mono text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
                            {rate.toFixed(1)}x
                        </span>
                    </div>
                    <Slider
                        value={[rate]}
                        min={0.5}
                        max={2.0}
                        step={0.1}
                        onValueChange={handleRateChange}
                        className="py-4 [&_.bg-primary]:bg-indigo-600 [&_.bg-primary\/20]:bg-indigo-600/20 [&_.border-primary\/50]:border-indigo-600/50"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 px-1">
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
                        className="flex-1 bg-slate-800/50 border-slate-700 hover:bg-slate-800 text-white"
                    >
                        {isPlaying ? (
                            <span className="animate-pulse">Speaking...</span>
                        ) : (
                            <>
                                <Play className="w-4 h-4 mr-2" />
                                Test Voice
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold"
                    >
                        Save Settings
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
