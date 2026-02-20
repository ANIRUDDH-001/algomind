'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Play, Loader2 } from 'lucide-react';
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
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 rounded-lg border border-slate-700">
            <div className="text-center space-y-4 p-8">
                {/* Loading Animation */}
                <div className="w-16 h-16 mx-auto relative">
                    <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-blue-600 rounded-full animate-spin border-t-transparent"></div>
                </div>

                {/* Status Text */}
                <div>
                    <h3 className="text-white font-semibold mb-2">
                        Loading Code Editor
                    </h3>
                    <p className="text-slate-400 text-sm">
                        {slowNetwork ? 'Still loading... This may take a while on slow networks' : 'Downloading Monaco Editor (2MB)...'}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${progress}%` }}
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
    onLanguageChange?: (lang: string) => void;
    onExecutionResult?: (result: ExecutionResult) => void;
}

const LANGUAGE_API_MAP: Record<string, string> = {
    python: 'python',
    javascript: 'javascript',
    typescript: 'javascript',
    java: 'java',
    cpp: 'cpp',
};

export function CodeEditor({ onCodeChange, defaultLanguage = 'python', initialCode = '', onLanguageChange, onExecutionResult }: CodeEditorProps) {
    const [code, setCode] = useState(initialCode);
    const [language, setLanguage] = useState(defaultLanguage);
    const [isRunning, setIsRunning] = useState(false);
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [activeTab, setActiveTab] = useState<'output' | 'error' | 'info'>('output');

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

        if (!currentCode.trim()) return;

        setIsRunning(true);
        setExecutionResult(null);

        try {
            const apiLang = LANGUAGE_API_MAP[currentLang] || currentLang;
            const res = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: apiLang, code: currentCode }),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                setExecutionResult({
                    stdout: '',
                    stderr: errorData.error || `Execution failed with status ${res.status}`,
                    exit_code: 1,
                    runtime_ms: 0,
                    language: apiLang,
                });
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
            setExecutionResult({
                stdout: '',
                stderr: error instanceof Error ? error.message : 'Unknown execution error',
                exit_code: 1,
                runtime_ms: 0,
                language: currentLang,
            });
            setActiveTab('error');
        } finally {
            setIsRunning(false);
        }
    };

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
            handleRunCode();
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
            <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700 rounded-t-lg">
                <div className="flex items-center gap-2" data-tour="language-select">
                    <span className="text-sm text-slate-400">Language:</span>
                    <select
                        value={language}
                        onChange={(e) => {
                            const newLang = e.target.value;
                            setLanguage(newLang);
                            onLanguageChange?.(newLang);
                        }}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded border border-slate-700 text-sm focus:outline-none focus:border-blue-500"
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
                        disabled={isRunning || !code.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded border border-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium mr-2"
                    >
                        {isRunning ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 fill-current" />
                        )}
                        Run
                    </button>
                    <div className="w-px h-5 bg-slate-700 mx-1"></div>
                    <button
                        onClick={() => {
                            setCode('');
                            onCodeChange('');
                        }}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => navigator.clipboard.writeText(code)}
                        className="px-3 py-1.5 text-sm text-slate-400 hover:text-white transition-colors"
                    >
                        Copy
                    </button>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="flex-1 min-h-[300px]">
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
                        suggestOnTriggerCharacters: true,
                        accessibilitySupport: 'auto',
                        formatOnPaste: true,
                        formatOnType: true,
                    }}
                />
            </div>

            {/* Execution Panel */}
            {(executionResult || isRunning) && (
                <div className="h-48 max-h-[200px] border-t border-slate-700 bg-slate-900 flex flex-col shrink-0 overflow-hidden rounded-b-lg">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700 text-sm">
                        <div className="flex items-center gap-4">
                            {isRunning ? (
                                <span className="text-slate-400 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Executing...
                                </span>
                            ) : executionResult && (
                                <>
                                    <button
                                        onClick={() => setActiveTab('output')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'output' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                                    >
                                        Output
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('error')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'error' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                                    >
                                        Error
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`pb-1 px-1 border-b-2 transition-colors ${activeTab === 'info' ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-300'}`}
                                    >
                                        Info
                                    </button>
                                </>
                            )}
                        </div>
                        {!isRunning && (
                            <button
                                onClick={() => setExecutionResult(null)}
                                className="text-slate-400 hover:text-white transition-colors"
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
                                    <pre className={`whitespace-pre-wrap ${executionResult.exit_code === 0 ? 'text-green-400' : 'text-slate-300'}`}>
                                        {executionResult.stdout || <span className="text-slate-500 italic">No output</span>}
                                    </pre>
                                )}
                                {activeTab === 'error' && (
                                    <pre className="whitespace-pre-wrap text-amber-400">
                                        {executionResult.stderr || <span className="text-slate-500 italic">No errors</span>}
                                    </pre>
                                )}
                                {activeTab === 'info' && (
                                    <div className="text-slate-400">
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
