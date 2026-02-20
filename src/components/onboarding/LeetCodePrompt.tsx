'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Code2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProgress } from '@/hooks/useProgress';

export function LeetCodePrompt() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [usernameInput, setUsernameInput] = useState('');
    const { progress } = useProgress();

    useEffect(() => {
        const checkEligibility = async () => {
            // 1. Has user dismissed it before?
            if (localStorage.getItem('leetcode_prompt_dismissed') === 'true') {
                setIsLoading(false);
                return;
            }

            // 2. Has user completed at least 1 session?
            if (!progress || progress.totalSessions < 1) {
                setIsLoading(false);
                return;
            }

            // 3. Are they already connected?
            try {
                const res = await fetch('/api/leetcode/status');
                if (res.ok) {
                    const data = await res.json();
                    if (!data.connected) {
                        setIsOpen(true);
                    } else {
                        // Mark dismissed anyway since they are connected
                        localStorage.setItem('leetcode_prompt_dismissed', 'true');
                    }
                }
            } catch (error) {
                console.error('Failed to check LeetCode status for prompt', error);
            } finally {
                setIsLoading(false);
            }
        };

        checkEligibility();
    }, [progress]);

    const handleSkip = () => {
        localStorage.setItem('leetcode_prompt_dismissed', 'true');
        setIsOpen(false);
    };

    const handleConnect = async () => {
        if (!usernameInput.trim()) return;

        setIsConnecting(true);
        try {
            const res = await fetch('/api/leetcode/connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: usernameInput.trim() }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to connect');

            toast.success(data.message);
            localStorage.setItem('leetcode_prompt_dismissed', 'true');

            // Artificial delay for UX
            setTimeout(() => {
                setIsOpen(false);
                // Dispatch event to allow LeetCodeSettings to refresh immediately if on the same page
                window.dispatchEvent(new Event('leetcode-connected'));
            }, 1000);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Connection failed');
            setIsConnecting(false);
        }
    };

    if (isLoading) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) handleSkip();
        }}>
            <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-[425px]">
                <DialogHeader className="space-y-3">
                    <div className="mx-auto bg-slate-800/50 p-3 rounded-2xl border border-slate-700 mb-2">
                        <Code2 className="w-8 h-8 text-yellow-500" />
                    </div>
                    <DialogTitle className="text-xl text-center">Personalize your practice</DialogTitle>
                    <DialogDescription className="text-center text-slate-400">
                        Connect your LeetCode account and AlgoMind will tailor question difficulty to your actual skill level — so you're always challenged, never overwhelmed.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 flex flex-col gap-4">
                    <Input
                        placeholder="your-leetcode-username"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value)}
                        className="bg-slate-950/50 border-slate-700 text-white placeholder:text-slate-600"
                        onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                        autoFocus
                    />
                    <Button
                        onClick={handleConnect}
                        disabled={isConnecting || !usernameInput.trim()}
                        className="w-full bg-yellow-600/20 text-yellow-500 hover:bg-yellow-600 hover:text-white border border-yellow-900/50 font-bold"
                    >
                        {isConnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        {isConnecting ? 'Connecting...' : 'Connect'}
                    </Button>
                </div>

                <DialogFooter className="sm:justify-center">
                    <button
                        onClick={handleSkip}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline-offset-4 hover:underline"
                    >
                        Skip for now
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
