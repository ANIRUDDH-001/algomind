/**
 * @codesage
 * @file      src/components/interview/MobileWarning.tsx
 * @purpose   Warning modal for users accessing the platform on mobile devices.
 * @tech      React, Tailwind CSS
 * @connects  @/lib/utils/device-detection
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import { getDeviceName } from '@/lib/utils/device-detection';

interface MobileWarningProps {
    onContinue: () => void;
    onExit: () => void;
}

export function MobileWarning({ onContinue, onExit }: MobileWarningProps) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="rounded-xl p-6 max-w-md w-full" style={{ background: 'var(--surface-2)', border: '1px solid var(--surface-edge-hi)' }}>
                <div className="text-center mb-6">
                    <div className="text-5xl mb-4">📱</div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Mobile Device Detected
                    </h2>
                    <p className="text-zinc-400">
                        You&apos;re using a {getDeviceName()}
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                        <h3 className="text-yellow-400 font-semibold mb-2">
                            ⚠️ Limited Functionality
                        </h3>
                        <p className="text-sm text-yellow-200/80">
                            The code editor has limited functionality on mobile devices.
                            You can switch to the "Code" tab to view or share solutions,
                            but a desktop experience is recommended for coding and testing.
                        </p>
                    </div>

                    <div className="p-4 bg-indigo-950/40 border border-indigo-500/20 rounded-lg">
                        <h3 className="text-indigo-400 font-semibold mb-2">
                            💡 Recommendation
                        </h3>
                        <p className="text-sm text-zinc-300">
                            For the best interview experience with full code editor support,
                            please use a desktop or laptop computer.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onExit}
                        className="w-full px-4 py-3 text-white rounded-lg font-medium transition-colors"
                        style={{ background: 'var(--accent-primary)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
                        onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
                    >
                        Switch to Desktop
                    </button>
                    <button
                        onClick={onContinue}
                        className="w-full px-4 py-3 text-zinc-300 rounded-lg font-medium transition-colors"
                        style={{ background: 'var(--surface-3)', border: '1px solid var(--surface-edge)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-edge-hi)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-3)')}
                    >
                        Continue Anyway (Voice Only)
                    </button>
                </div>
            </div>
        </div>
    );
}
