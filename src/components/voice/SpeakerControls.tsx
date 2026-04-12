import React from 'react';
import { Play, Pause, Square, Volume2, FastForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';

interface SpeakerControlsProps {
    isSpeaking: boolean;
    isPaused: boolean;
    onPause: () => void;
    onResume: () => void;
    onStop: () => void;
    availableVoices: SpeechSynthesisVoice[];
    currentVoice: SpeechSynthesisVoice | null;
    onVoiceChange: (voice: SpeechSynthesisVoice) => void;
    rate: number;
    onRateChange: (rate: number) => void;
}

export function SpeakerControls({
    isSpeaking,
    isPaused,
    onPause,
    onResume,
    onStop,
    availableVoices,
    currentVoice,
    onVoiceChange,
    rate,
    onRateChange
}: SpeakerControlsProps) {

    // Filter voices to English only for relevance
    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en'));

    return (
        <div className="flex flex-col gap-4 p-4 border rounded-xl bg-[var(--surface-1)]/50 backdrop-blur-sm shadow-sm">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-blue-400" />
                    <span className="font-semibold text-white">AI Voice</span>
                    {isSpeaking && !isPaused && (
                        <Badge variant="outline" className="animate-pulse bg-blue-500/20 text-blue-300 border-blue-500/50">Speaking</Badge>
                    )}
                </div>

                <div className="flex gap-2">
                    {isSpeaking && !isPaused ? (
                        <Button size="icon" variant="ghost" onClick={onPause} className="h-8 w-8 hover:bg-[var(--surface-2)]">
                            <Pause className="h-4 w-4" />
                        </Button>
                    ) : isSpeaking && isPaused ? (
                        <Button size="icon" variant="ghost" onClick={onResume} className="h-8 w-8 hover:bg-[var(--surface-2)]">
                            <Play className="h-4 w-4" />
                        </Button>
                    ) : (
                        <Button size="icon" variant="ghost" disabled className="h-8 w-8 opacity-50">
                            <Play className="h-4 w-4" />
                        </Button>
                    )}

                    <Button size="icon" variant="ghost" onClick={onStop} disabled={!isSpeaking} className="h-8 w-8 hover:bg-red-900/20 hover:text-red-400">
                        <Square className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Voice Settings */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">Voice</span>
                    <Select
                        value={currentVoice?.name}
                        onValueChange={(val) => {
                            const v = availableVoices.find(voice => voice.name === val);
                            if (v) onVoiceChange(v);
                        }}
                    >
                        <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-white/10">
                            <SelectValue placeholder="Select Voice" />
                        </SelectTrigger>
                        <SelectContent>
                            {englishVoices.map(v => (
                                <SelectItem key={v.name} value={v.name}>
                                    {v.name.replace('Microsoft', '').replace('Google', '').trim()} ({v.lang})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-12">Speed</span>
                    <div className="flex-1 flex items-center gap-2">
                        <span className="text-xs w-6 text-center">{rate}x</span>
                        <Slider
                            value={[rate]}
                            min={0.5}
                            max={2.0}
                            step={0.1}
                            onValueChange={(val) => onRateChange(val[0])}
                            className="flex-1"
                        />
                        <FastForward className="h-3 w-3 text-muted-foreground" />
                    </div>
                </div>
            </div>
        </div>
    );
}
