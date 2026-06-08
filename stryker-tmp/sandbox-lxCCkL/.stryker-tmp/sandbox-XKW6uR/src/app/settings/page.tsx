/**
 * @codesage
 * @file      src/app/settings/page.tsx
 * @purpose   Settings page wrapper rendering the SettingsPanel.
 * @tech      React, Next.js
 * @connects  SettingsPanel
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { SettingsPanel } from '@/components/settings/SettingsPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
    return (
        <div className="page-container max-w-2xl mx-auto py-12 pb-20 md:pb-4">
            <Link href="/dashboard" className="inline-flex items-center text-zinc-400 hover:text-white transition-colors mb-6 text-sm font-bold uppercase tracking-widest">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
            </Link>
            <h1 className="text-4xl font-black text-white mb-2">Settings</h1>
            <p className="text-zinc-400 mb-8">Manage your profile, preferences, and connected services.</p>
            <SettingsPanel />
        </div>
    );
}
