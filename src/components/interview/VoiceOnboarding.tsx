import * as React from 'react';
import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query'; // Ensure this hook exists or create it
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
    DrawerClose
} from '@/components/ui/drawer';
import { Mic, Volume2, Zap, Globe } from 'lucide-react';

export function VoiceOnboarding() {
    const [open, setOpen] = useState(false);
    const isDesktop = useMediaQuery("(min-width: 768px)");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const hasSeen = localStorage.getItem('voice_onboarding_seen');
            if (!hasSeen) {
                setOpen(true);
            }
        }
    }, []);

    const handleComplete = () => {
        localStorage.setItem('voice_onboarding_seen', 'true');
        setOpen(false);
    };

    const OnboardingContent = () => (
        <div className="space-y-6">
            <div className="flex gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg h-fit shrink-0">
                    <Mic className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Natural Conversations</h3>
                    <p className="text-sm text-muted-foreground">
                        Talk naturally. The AI listens and responds like a real interviewer.
                        You can interrupt anytime if you need to clarify.
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg h-fit shrink-0">
                    <Zap className="w-6 h-6 text-green-600 dark:text-green-300" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Lightning Fast</h3>
                    <p className="text-sm text-muted-foreground">
                        Simple questions get instant answers. Complex topics get detailed explanations.
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg h-fit shrink-0">
                    <Globe className="w-6 h-6 text-purple-600 dark:text-purple-300" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Hinglish Support</h3>
                    <p className="text-sm text-muted-foreground">
                        Speak in English, Hindi, or mix both! Technical terms stay in English.
                    </p>
                </div>
            </div>

            <div className="flex gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg h-fit shrink-0">
                    <Volume2 className="w-6 h-6 text-orange-600 dark:text-orange-300" />
                </div>
                <div className="flex-1">
                    <h3 className="font-semibold mb-1">Voice Controls</h3>
                    <p className="text-sm text-muted-foreground">
                        Click the mic to start/stop. The AI will wait patiently while you think.
                    </p>
                </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
                <h4 className="text-sm font-bold mb-2 text-foreground">Tips for Best Experience:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Use a quiet environment with minimal background noise</li>
                    <li>Speak clearly but naturally - no need to over-enunciate</li>
                    <li>Let the AI finish key points, but feel free to interrupt if needed</li>
                    <li>Take your time thinking - there's no rush</li>
                </ul>
            </div>
        </div>
    );

    if (isDesktop) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="text-2xl">Welcome to Voice Interviews! 🎤</DialogTitle>
                    </DialogHeader>
                    <div className="py-2 overflow-y-auto flex-1 px-1">
                        <OnboardingContent />
                    </div>
                    <div className="flex justify-end gap-2 pt-4 mt-auto border-t shrink-0">
                        <Button onClick={handleComplete} data-testid="onboarding-complete">
                            Got it, let's start!
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm">
                    <DrawerHeader>
                        <DrawerTitle className="text-2xl">Welcome to Voice Interviews! 🎤</DrawerTitle>
                    </DrawerHeader>
                    <div className="p-4 pb-0 max-h-[60vh] overflow-y-auto">
                        <OnboardingContent />
                    </div>
                    <DrawerFooter>
                        <Button onClick={handleComplete} className="w-full">
                            Got it, let's start!
                        </Button>
                        <DrawerClose asChild>
                            <Button variant="outline" className="w-full">Close</Button>
                        </DrawerClose>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
