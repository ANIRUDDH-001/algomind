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
                <div className="fixed inset-0 top-16 bg-slate-950 flex items-center justify-center text-white">
                    <div className="text-center max-w-md px-6">
                        <p className="text-red-400 text-lg mb-4">Session encountered an unexpected error</p>
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors rounded-xl font-bold"
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
