/**
 * @codesage
 * @file      src/components/interview/InterviewErrorBoundary.tsx
 * @purpose   Catches and displays runtime errors within the interview session view.
 * @tech      React (Class Component), Tailwind CSS
 * @connects  None
 * @apis      None
 * @db        None
 * @state     Component state (hasError, error)
 * @env       None
 * @issues    console.error used for logging (intentional)
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

'use client';

import React, { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class InterviewErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[InterviewSession Error]', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 top-[var(--navbar-h,64px)] flex items-center justify-center text-white" style={{ background: 'var(--surface-base)' }}>
                    <div className="text-center max-w-md px-6">
                        <p className="text-red-400 text-lg mb-4">Session encountered an unexpected error</p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 transition-colors rounded-xl font-bold"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
