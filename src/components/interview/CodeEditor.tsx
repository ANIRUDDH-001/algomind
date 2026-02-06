'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

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
}

export function CodeEditor({ onCodeChange, defaultLanguage = 'python', initialCode = '', onLanguageChange }: CodeEditorProps) {
    const [code, setCode] = useState(initialCode);
    const [language, setLanguage] = useState(defaultLanguage);

    const handleEditorChange = (value: string | undefined) => {
        const newCode = value || '';
        setCode(newCode);
        onCodeChange(newCode);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Editor Header */}
            <div className="flex items-center justify-between p-3 bg-slate-800 border-b border-slate-700 rounded-t-lg">
                <div className="flex items-center gap-2">
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

                <div className="flex gap-2">
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
        </div>
    );
}
