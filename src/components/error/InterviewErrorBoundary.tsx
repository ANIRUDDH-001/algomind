/**
 * @codesage
 * @file      src/components/error/InterviewErrorBoundary.tsx
 * @purpose   Catches and handles errors during an interview session.
 * @tech      React (Class Component)
 * @connects  None
 * @apis      None
 * @db        None
 * @state     Component state (hasError)
 * @env       None
 * @issues    console.error used for logging (intentional)
 * @audit     CODESAGE-v1
 */
'use client';
import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class InterviewErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[InterviewErrorBoundary]', error, info);
        // Could log to system_events here via fetch
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--surface-base)' }}>
                    <div className="text-center space-y-4 max-w-md">
                        <p className="text-2xl">⚠️</p>
                        <h2 className="text-xl font-bold text-white">Interview session crashed</h2>
                        <p className="text-zinc-400 text-sm">{this.state.error?.message}</p>
                        <button
                            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
                            className="px-4 py-2 bg-blue-600 rounded-xl text-white text-sm font-bold hover:bg-blue-500 transition"
                        >
                            Reload and retry
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
