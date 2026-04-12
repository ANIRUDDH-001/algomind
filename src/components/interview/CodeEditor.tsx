'use client';

import { useState, useEffect, useRef, useId } from 'react';
import dynamic from 'next/dynamic';
import { Play } from 'lucide-react';
import { OnMount } from '@monaco-editor/react';

export interface ExecutionResult {
    stdout: string;
    stderr: string;
    exit_code: number;
    runtime_ms: number;
    language: string;
}


// Lazy load Monaco Editor (2MB - only load when needed)
const Editor = dynamic(() => import('@monaco-editor/react'), {
    ssr: false,
    loading: () => <EditorLoadingState />,
});

function EditorLoadingState() {
    const [progress, setProgress] = useState(0);
    const [slowNetwork, setSlowNetwork] = useState(false);

    useEffect(() => {
        // Simulate progress
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 90) return prev;
                return prev + 10;
            });
        }, 500);

        // Detect slow network after 10 seconds
        const slowTimer = setTimeout(() => {
            setSlowNetwork(true);
        }, 10000);

        return () => {
            clearInterval(interval);
            clearTimeout(slowTimer);
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-center h-full rounded-lg" style={{ background: 'var(--surface-1)', border: '1px solid var(--surface-edge)' }}>
            <div className="text-center space-y-4 p-8">
                {/* Loading Animation */}
                <div className="w-16 h-16 mx-auto relative">
                    <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full animate-spin border-t-transparent"></div>
                </div>

                {/* Status Text */}
                <div>
                    <h3 className="text-white font-semibold mb-2">
                        Loading Code Editor
                    </h3>
                    <p className="text-zinc-400 text-sm">
                        {slowNetwork ? 'Still loading... This may take a while on slow networks' : 'Downloading Monaco Editor (2MB)...'}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                    <div
                        className="h-full transition-all duration-300"
                        style={{ width: `${progress}%`, background: 'var(--accent-primary)' }}
                    />
                </div>

                {/* Slow Network Options */}
                {slowNetwork && (
                    <div className="mt-4 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
                        <p className="text-sm text-yellow-400 mb-3">
                            Slow network detected. Please wait or check your connection.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

interface CodeEditorProps {
    onCodeChange: (code: string) => void;
    defaultLanguage?: string;
    initialCode?: string;
    problemTitle?: string;
    onLanguageChange?: (lang: string) => void;
    onExecutionStart?: () => void;
    onExecutionResult?: (result: ExecutionResult) => void;
    readOnly?: boolean;
    onKeyDown?: () => void;
    runDisabled?: boolean;
}

const LANGUAGE_API_MAP: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'javascript',
    java: 'java',
    cpp: 'cpp',
};

export function CodeEditor({ onCodeChange, defaultLanguage = 'python', initialCode = '', problemTitle, onLanguageChange, onExecutionStart, onExecutionResult, readOnly = false, onKeyDown, runDisabled = false }: CodeEditorProps) {
    const [code, setCode] = useState(initialCode);
    const [language, setLanguage] = useState(defaultLanguage);
    const [isRunning, setIsRunning] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<'output' | 'error' | 'info'>('output');
    const editorLabelId = useId();

    const [editorHeight, setEditorHeight] = useState<string>('calc(100dvh - 320px)');

    useEffect(() => {
        const updateHeight = () => {
            setEditorHeight(window.innerWidth >= 1024 ? '100%' : 'calc(100dvh - 320px)');
        };
        updateHeight();
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
    }, []);

    // Ref to hold the current values for the shortcut handler
    const codeRef = useRef(code);
    const languageRef = useRef(language);

    useEffect(() => {
        codeRef.current = code;
    }, [code]);

    useEffect(() => {
        languageRef.current = language;
    }, [language]);

    const handleRunCode = async () => {
        const currentCode = codeRef.current;
        const currentLang = languageRef.current;

        if (!currentCode.trim() || runDisabled) return;

        setIsRunning(true);
        setExecutionResult(null);
        onExecutionStart?.();

        try {
            const apiLang = LANGUAGE_API_MAP[currentLang] || currentLang;
            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: apiLang, code: currentCode }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                const result: ExecutionResult = {
                    stdout: '',
                    stderr: errorData.error || `Execution failed with status ${res.status}`,
                    exit_code: 1,
                    runtime_ms: 0,
                    language: apiLang,
                };
                setExecutionResult(result);
                onExecutionResult?.(result);
                setActiveTab('error');
            } else {
                const data = await res.json();
                const result: ExecutionResult = { ...data, language: apiLang };
                setExecutionResult(result);
                onExecutionResult?.(result);

                if (data.stderr && !data.stdout) {
                    setActiveTab('error');
                } else {
                    setActiveTab('output');
                }
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown execution error';
            const isNetwork = msg.includes('fetch') || msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('network');
            const result: ExecutionResult = {
                stdout: '',
                stderr: isNetwork
                    ? 'Code execution service unavailable. Please try again in a moment.'
                    : msg,
                exit_code: 1,
                runtime_ms: 0,
                language: currentLang,
            };
            setExecutionResult(result);
            onExecutionResult?.(result);
            setActiveTab('error');
        } finally {
            setIsRunning(false);
        }
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            handleRunCode();
        });
        editor.onKeyDown(() => {
            onKeyDown?.();
        });
    };

    const handleEditorChange = (value: string | undefined) => {
        const newCode = value || '';
        setCode(newCode);
        onCodeChange(newCode);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Editor Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-t-lg" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-edge)' }}>
                <div className="flex items-center gap-2" data-tour="language-select">
                    <span className="text-xs sm:text-sm text-zinc-400 whitespace-nowrap">Lang:</span>
                    <select
                        value={language}
                        onChange={(e) => {
                            const newLang = e.target.value;
                            setLanguage(newLang);
                            onLanguageChange?.(newLang);
                        }}
                        className="px-2 sm:px-3 py-1.5 text-white rounded text-xs sm:text-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 min-w-0"
                        style={{ background: 'var(--surface-base)', border: '1px solid var(--surface-edge)' }}
                    >
                        <option value="python">Python</option>
                        <option value="javascript">JavaScript</option>
                        <option value="typescript">TypeScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRunCode}
                        disabled={isRunning || !code.trim() || runDisabled}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm font-medium"
                        style={{ background: 'var(--accent-primary)', border: '1px solid rgba(99,102,241,0.3)' }}
                    >
                        {isRunning ? (
                            <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 fill-current" />
                        )}
                        Run
                    </button>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1" style={{ height: editorHeight, minHeight: '200px' }}>
                <div className="sr-only" id={editorLabelId}>
                    Code editor - write your solution here
                </div>
                <div aria-labelledby={editorLabelId} className="h-full">
                    <Editor
                        height="100%"
                        language={language}
                        value={code}
                        onChange={handleEditorChange}
                        onMount={handleEditorDidMount}
                        theme="vs-dark"
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            tabSize: 2,
                            wordWrap: 'on',
                            quickSuggestions: true,
                            suggestOnTriggerCharacters: !readOnly,
                            accessibilitySupport: 'auto',
                            ariaLabel: `Code editor for ${problemTitle ?? 'interview problem'}. Press Escape to exit focus mode.`,
                            formatOnPaste: !readOnly,
                            formatOnType: !readOnly,
                            readOnly: readOnly,
                        }}
                    />
                </div>
            </div>

            {/* Execution Panel */}
            {(executionResult || isRunning) && (
                <div className="h-48 max-h-[200px] flex flex-col shrink-0 overflow-hidden rounded-b-lg" style={{ background: 'var(--surface-1)', borderTop: '1px solid var(--surface-edge)' }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 text-sm" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--surface-edge)' }}>
                        <div className="flex items-center gap-4">
                            {isRunning ? (
                                <span className="text-zinc-400 flex items-center gap-2">
                                    <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                                    Executing...
                                </span>
                            ) : executionResult && (
                                <>
                                    <button
                                        onClick={() => setActiveTab('output')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'output' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'}`}
                                    >
                                        Output
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('error')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'error' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'}`}
                                    >
                                        Error
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'info' ? 'border-indigo-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'}`}
                                    >
                                        Info
                                    </button>
                                </>
                            )}
                        </div>
                        {!isRunning && (
                            <button
                                onClick={() => setExecutionResult(null)}
                                className="text-zinc-400 hover:text-white transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-sm leading-relaxed">
                        {!isRunning && executionResult && (
                            <>
                                {activeTab === 'output' && (
                                    <pre className={`whitespace-pre-wrap ${executionResult.exit_code === 0 ? 'text-green-400' : 'text-zinc-300'}`}>
                                        {executionResult.stdout || <span className="text-zinc-500 italic">No output</span>}
                                    </pre>
                                )}
                                {activeTab === 'error' && (
                                    <pre className="whitespace-pre-wrap text-amber-400">
                                        {executionResult.stderr || <span className="text-zinc-500 italic">No errors</span>}
                                    </pre>
                                )}
                                {activeTab === 'info' && (
                                    <div className="text-zinc-400">
                                        Exit code: {executionResult.exit_code} | Runtime: {executionResult.runtime_ms}ms
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
