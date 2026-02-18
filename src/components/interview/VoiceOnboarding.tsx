'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Volume2, Zap, Globe } from 'lucide-react';

export function VoiceOnboarding() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        // Show only on first visit
        // In a real app we might check user profile, but localStorage is good for device-specific onboarding
        const hasSeenOnboarding = localStorage.getItem('voice_onboarding_seen');
        if (!hasSeenOnboarding) {
            setOpen(true);
        }
    }, []);

    const handleComplete = () => {
        localStorage.setItem('voice_onboarding_seen', 'true');
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl">Welcome to Voice Interviews! 🎤</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg h-fit">
                            <Mic className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">Natural Conversations</h3>
                            <p className="text-sm text-muted-foreground">
                                Talk naturally. The AI listens and responds like a real interviewer.
                                You can interrupt anytime if you need to clarify or change direction.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg h-fit">
                            <Zap className="w-6 h-6 text-green-600 dark:text-green-300" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">Lightning Fast</h3>
                            <p className="text-sm text-muted-foreground">
                                Simple questions get instant answers. Complex topics get detailed explanations.
                                Our smart system knows when to use fast or thorough responses.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg h-fit">
                            <Globe className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">Hinglish Support</h3>
                            <p className="text-sm text-muted-foreground">
                                Speak in English, Hindi, or mix both! Technical terms stay in English,
                                but you can use Hindi for questions and explanations.
                            </p>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg h-fit">
                            <Volume2 className="w-6 h-6 text-orange-600 dark:text-orange-300" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">Voice Controls</h3>
                            <p className="text-sm text-muted-foreground">
                                Click the mic to start/stop. The AI will wait patiently while you think.
                                Status indicator shows when the system is listening or speaking.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                        <p className="text-sm font-medium mb-2">Tips for Best Experience:</p>
                        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                            <li>Use a quiet environment with minimal background noise</li>
                            <li>Speak clearly but naturally - no need to over-enunciate</li>
                            <li>Let the AI finish key points, but feel free to interrupt if needed</li>
                            <li>Take your time thinking - there's no rush</li>
                        </ul>
                    </div>
                </div>

                <div className="flex justify-end gap-2">
                    <Button onClick={handleComplete}>
                        Got it, let's start!
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
