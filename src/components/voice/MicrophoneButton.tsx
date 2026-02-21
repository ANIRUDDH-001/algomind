/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MicrophoneButtonProps {
    isListening: boolean;
    onClick: () => void;
    disabled?: boolean;
    className?: string;
    error?: string | null;
}

export function MicrophoneButton({
    isListening,
    onClick,
    disabled = false,
    className,
    error
}: MicrophoneButtonProps) {

    // Visual states: idle (gray), listening (pulsing blue), processing (spinning - implicitly handled by parent logic usually, but here mapped to listening for now)

    return (
        <div className="flex flex-col items-center gap-2">
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={isListening ? "default" : "outline"}
                            size="icon"
                            data-testid="mic-button"
                            className={cn(
                                "h-16 w-16 rounded-full transition-all duration-200 shadow-lg relative",
                                isListening
                                    ? "bg-blue-600 hover:bg-blue-700 border-blue-500 ring-2 ring-blue-500/20"
                                    : "bg-white hover:bg-slate-200 text-slate-900 border-white ring-2 ring-white/20",
                                error ? "border-red-500 text-red-500" : "",
                                className
                            )}
                            onClick={onClick}
                            disabled={disabled}
                        >
                            {isListening ? (
                                <Mic className="h-8 w-8 text-white" />
                            ) : (
                                <MicOff className={cn("h-8 w-8", error ? "text-red-500" : "text-slate-900")} />
                            )}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        {error ? error : isListening ? "Stop Listening" : "Start Speaking"}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* State Label */}
            <Badge variant={isListening ? "default" : "secondary"} className={cn(isListening ? "bg-blue-100 text-blue-800 hover:bg-blue-200" : "")}>
                {isListening ? "Listening..." : "Click to Speak"}
            </Badge>
        </div>
    );
}
