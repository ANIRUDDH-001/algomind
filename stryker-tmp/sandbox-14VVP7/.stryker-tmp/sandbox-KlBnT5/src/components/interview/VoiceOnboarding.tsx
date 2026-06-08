/**
 * @codesage
 * @file      src/components/interview/VoiceOnboarding.tsx
 * @purpose   Provides a modal/drawer for onboarding users to voice interaction.
 * @tech      React, Tailwind CSS, Lucide
 * @connects  @/components/ui/dialog, @/components/ui/drawer
 * @apis      None
 * @db        None
 * @state     useState, useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/* eslint-disable react-hooks/set-state-in-effect */
//  -- automated unused local suppression
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerDescription,
    DrawerFooter,
    DrawerClose
} from '@/components/ui/drawer';
//  -- automated unused local suppression
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

    const onboardingContent = (
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

            <div className="p-4 bg-secondary/50 rounded-lg border border-border">
                <h4 className="text-sm font-bold mb-2 text-foreground">Tips for Best Experience:</h4>
                <ul className="text-sm text-foreground/90 space-y-1 list-disc list-inside">
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
                        <DialogDescription className="text-zinc-400">
                            Learn how to interact with Kai using your voice for a natural interview experience.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 overflow-y-auto flex-1 px-1">
                        {onboardingContent}
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
                        <DrawerDescription className="text-zinc-400">
                            Learn how to interact with Kai using your voice for a natural interview experience.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="p-4 pb-0 max-h-[60vh] overflow-y-auto">
                        {onboardingContent}
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
