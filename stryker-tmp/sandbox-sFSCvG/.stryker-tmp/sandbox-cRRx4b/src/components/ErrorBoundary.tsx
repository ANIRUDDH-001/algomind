// @ts-nocheck
// 
'use client';

/**
 * @codesage
 * @file      src/components/ErrorBoundary.tsx
 * @purpose   Provides a React error boundary to catch and gracefully display unexpected component errors.
 * @tech      React, TailwindCSS, lucide-react
 * @connects  Imports reportError from @/lib/telemetry/report-error
 * @apis      none
 * @db        none
 * @state     Local error state (hasError, error, errorInfo)
 * @env       NODE_ENV
 * @issues    none
 * @audit     CODESAGE-v1
 */

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { reportError } from '@/lib/telemetry/report-error';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        reportError(error, {
            componentStack: errorInfo.componentStack || undefined,
            severity: 'fatal',
        });
        this.setState({ errorInfo });
    }

    handleReload = () => {
        window.location.reload();
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
                    <div className="text-center p-8 bg-[var(--surface-1)]/50 border border-white/8 rounded-2xl shadow-2xl max-w-md w-full">
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-400" />
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">
                            Something went wrong
                        </h2>

                        <p className="text-zinc-400 mb-6 text-sm">
                            {this.state.error?.message || 'An unexpected error occurred. Please try again.'}
                        </p>

                        {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                            <details className="mb-6 text-left">
                                <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">
                                    Show error details
                                </summary>
                                <pre className="mt-2 p-3 bg-[var(--surface-base)] rounded-lg text-xs text-red-400 overflow-auto max-h-40">
                                    {this.state.error?.stack}
                                </pre>
                            </details>
                        )}

                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReload}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Reload
                            </button>
                            <button
                                onClick={this.handleGoHome}
                                className="flex items-center gap-2 px-5 py-2.5 bg-[var(--surface-3)] hover:bg-[var(--surface-edge-hi)] text-white rounded-lg font-medium transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Go Home
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
