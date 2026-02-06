'use client';

import { getDeviceName } from '@/lib/utils/device-detection';

interface MobileWarningProps {
    onContinue: () => void;
    onExit: () => void;
}

export function MobileWarning({ onContinue, onExit }: MobileWarningProps) {
    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl p-6 max-w-md w-full border border-slate-700">
                <div className="text-center mb-6">
                    <div className="text-5xl mb-4">📱</div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Mobile Device Detected
                    </h2>
                    <p className="text-slate-400">
                        You&apos;re using a {getDeviceName()}
                    </p>
                </div>

                <div className="space-y-4 mb-6">
                    <div className="p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                        <h3 className="text-yellow-400 font-semibold mb-2">
                            ⚠️ Limited Functionality
                        </h3>
                        <p className="text-sm text-yellow-200/80">
                            The code editor is not available on mobile devices. You can continue
                            with voice-only interview, but you won&apos;t be able to write or test code visually.
                        </p>
                    </div>

                    <div className="p-4 bg-blue-900/20 border border-blue-600/30 rounded-lg">
                        <h3 className="text-blue-400 font-semibold mb-2">
                            💡 Recommendation
                        </h3>
                        <p className="text-sm text-blue-200/80">
                            For the best interview experience with full code editor support,
                            please use a desktop or laptop computer.
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onExit}
                        className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Switch to Desktop
                    </button>
                    <button
                        onClick={onContinue}
                        className="w-full px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                        Continue Anyway (Voice Only)
                    </button>
                </div>
            </div>
        </div>
    );
}
