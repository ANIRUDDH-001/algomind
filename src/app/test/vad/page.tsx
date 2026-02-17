'use client';

/**
 * VAD Test Page — isolated test environment for Voice Activity Detection.
 *
 * Route: /test/vad
 *
 * Gated behind NEXT_PUBLIC_ENABLE_VAD_TEST=true (or NODE_ENV=development).
 * In production without the flag, renders a 404-style message.
 *
 * The main content is loaded with `next/dynamic` + `ssr: false` to avoid
 * hydration mismatches — all VAD APIs are browser-only.
 */

import dynamic from 'next/dynamic';

// ---------------------------------------------------------------------------
// Gate check
// ---------------------------------------------------------------------------

const IS_ALLOWED =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ENABLE_VAD_TEST === 'true';

// ---------------------------------------------------------------------------
// Dynamic import — no SSR (browser-only APIs)
// ---------------------------------------------------------------------------

const VADTestContent = dynamic(() => import('./VADTestContent'), {
    ssr: false,
    loading: () => (
        <div className="container mx-auto max-w-3xl px-4 py-8">
            <h1 className="text-2xl font-bold tracking-tight">VAD Test Page</h1>
            <p className="text-muted-foreground text-sm mt-2">Loading…</p>
        </div>
    ),
});

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function VADTestPage() {
    if (!IS_ALLOWED) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <p className="text-muted-foreground text-lg">Page not found.</p>
            </div>
        );
    }

    return <VADTestContent />;
}
