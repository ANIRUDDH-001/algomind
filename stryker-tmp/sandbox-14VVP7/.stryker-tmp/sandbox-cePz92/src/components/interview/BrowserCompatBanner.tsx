/**
 * @codesage
 * @file      src/components/interview/BrowserCompatBanner.tsx
 * @purpose   Displays a warning banner for non-Chrome browsers.
 * @tech      React, Lucide
 * @connects  None
 * @apis      None
 * @db        None
 * @state     useState, useEffect
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

/* eslint-disable react-hooks/set-state-in-effect */
'use client';
import { useState, useEffect } from 'react';
import { Chrome, X } from 'lucide-react';

export function BrowserCompatBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
        const dismissed = sessionStorage.getItem('browser_banner_dismissed');
        if (!isChrome && !dismissed) setShow(true);
    }, []);

    if (!show) return null;

    return (
        <div className="w-full bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 text-amber-300">
                <Chrome className="w-4 h-4 shrink-0" />
                <span>
                    <strong>For best microphone experience</strong>, use Google Chrome.
                    Other browsers may have limited speech recognition support.
                </span>
            </div>
            <button
                onClick={() => { setShow(false); sessionStorage.setItem('browser_banner_dismissed', '1'); }}
                className="text-amber-400 hover:text-white shrink-0"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
