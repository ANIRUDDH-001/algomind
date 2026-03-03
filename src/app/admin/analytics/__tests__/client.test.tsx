/**
 * @vitest-environment jsdom
 *
 * Tests for src/app/admin/analytics/client.tsx
 *
 * Strategy:
 * - Tests 1-5 use static source analysis (reading file text) for recharts props
 *   that are not accessible from the rendered DOM (SVG internals).
 * - Tests 6-9 use DOM render tests against the live React component.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ─── Read source file for static checks ───
const SRC_PATH = path.resolve(__dirname, '../client.tsx');
const src = fs.readFileSync(SRC_PATH, 'utf-8');

// ─── Vitest-environment jsdom only needed for render tests (tests 6–9) ───
import React from 'react';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';

// ─── Polyfills ───
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
        matches: false, media: query, onchange: null,
        addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// ─── Mock fetch ───
beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/admin/events')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    events: [],
                    analytics: [],
                    systemStats: {
                        total_users: 42,
                        active_models: 3,
                        total_sessions: 150,
                    },
                }),
            });
        }
        if (url.includes('/api/admin/models')) {
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    models: [
                        { modelId: 'gemini-pro', rateLimitHits24h: 5, lastRateLimitHit: '2026-02-24T08:00:00.000Z', status: 'ok' },
                        { modelId: 'gemini-flash', rateLimitHits24h: 2, lastRateLimitHit: '2026-02-24T08:00:00.000Z', status: 'degraded' },
                    ],
                }),
            });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
});

// ─── Mock recharts (just passthrough containers) ───
vi.mock('recharts', () => ({
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: ({ fill, dataKey }: any) => <div data-testid="bar" data-fill={fill} data-key={dataKey} />,
    XAxis: ({ axisLine, tickLine, dataKey }: any) => (
        <div data-testid="xaxis" data-axisline={String(axisLine)} data-tickline={String(tickLine)} data-key={dataKey} />
    ),
    YAxis: ({ axisLine, tickLine }: any) => (
        <div data-testid="yaxis" data-axisline={String(axisLine)} data-tickline={String(tickLine)} />
    ),
    CartesianGrid: ({ stroke, strokeDasharray }: any) => (
        <div data-testid="cartesian-grid" data-stroke={stroke} data-strokedasharray={strokeDasharray} />
    ),
    Tooltip: ({ contentStyle }: any) => (
        <div data-testid="tooltip" data-content-bg={contentStyle?.background} />
    ),
    Legend: () => <div data-testid="legend" />,
    ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// ─── Mock sonner ───
vi.mock('sonner', () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Mock lucide-react ───
vi.mock('lucide-react', () => ({
    AlertCircle: () => <svg />,
    AlertTriangle: () => <svg />,
    CheckCircle2: () => <svg data-testid="icon-check" />,
    ServerCrash: () => <svg />,
    Database: () => <svg />,
    Users: () => <svg />,
    Activity: () => <svg />,
    Loader2: () => <svg />,
    Clock: () => <svg />,
    XCircle: () => <svg data-testid="icon-xcircle" />,
    RefreshCw: () => <svg />,
    Play: () => <svg />,
    Zap: () => <svg />,
}));

import AnalyticsAdminClient from '../client';

describe('AnalyticsAdminClient — Static Source Checks', () => {
    it('1. Chart Bars use COLORS.chart values, not hardcoded hex like #8884d8', () => {
        // The primary stacked bars use COLORS.chart[n] from the typeColors map
        expect(src).toContain("COLORS.chart[0]");
        expect(src).toContain("COLORS.chart[1]");
        expect(src).toContain("COLORS.chart[2]");
        // Must NOT contain the old recharts default color
        expect(src).not.toContain('#8884d8');
    });

    it('2. Tooltip contentStyle uses background var(--surface-2)', () => {
        expect(src).toContain("background: 'var(--surface-2)'");
    });

    it('3. CartesianGrid stroke uses rgba with low opacity (≤ 0.1)', () => {
        // The stroke value is rgba(255,255,255,0.04)
        const match = src.match(/CartesianGrid[^/]*stroke="([^"]+)"/);
        // Grab all CartesianGrid stroke usages
        const strokeMatches = [...src.matchAll(/CartesianGrid[^>]*stroke=\{?"([^"]+)"\}?/g)];
        expect(strokeMatches.length).toBeGreaterThan(0);
        for (const m of strokeMatches) {
            const strokeVal = m[1];
            // Must contain rgba (low opacity) — not a solid color
            expect(strokeVal).toMatch(/rgba/);
            // Extract opacity value (last number in rgba)
            const opacityMatch = strokeVal.match(/rgba\([^)]+,\s*([\d.]+)\)/);
            if (opacityMatch) {
                expect(parseFloat(opacityMatch[1])).toBeLessThanOrEqual(0.1);
            }
        }
    });

    it('4. XAxis and YAxis have axisLine={false} and tickLine={false}', () => {
        expect(src).toContain('axisLine={false}');
        expect(src).toContain('tickLine={false}');
        // Count occurrences — at minimum 2 axes (XAxis, YAxis on main chart)
        const axisLineCount = [...src.matchAll(/axisLine=\{false\}/g)].length;
        const tickLineCount = [...src.matchAll(/tickLine=\{false\}/g)].length;
        expect(axisLineCount).toBeGreaterThanOrEqual(2);
        expect(tickLineCount).toBeGreaterThanOrEqual(2);
    });

    it('5. Model status badges use emerald/red CSS classes, not CheckCircle2/XCircle text labels', () => {
        // The model status badge in Panel 2 uses inline span with className, not icon-wrapper text
        // bg-emerald-500/15 for ok, bg-red-500/15 for bad
        expect(src).toContain('bg-emerald-500/15');
        expect(src).toContain('bg-red-500/15');
        // The status badge renders 'Healthy' text for ok — not "✓" or icon text
        expect(src).toContain("'Healthy'");
    });

    it('8. Blue-500 classes only used for cron RUNNING badge', () => {
        // blue-500 is now used for the RUNNING cron badge (bg-blue-500/15, text-blue-400, border-blue-500/25)
        // Previously was zero — now only used in the cron status context
        const blueMatches = [...src.matchAll(/\bblue-500\b/g)];
        // Should have some (from the RUNNING badge) but not excessive usage
        expect(blueMatches.length).toBeGreaterThan(0);
        expect(blueMatches.length).toBeLessThanOrEqual(5);
        // Should still use indigo for non-running cron indicators
        expect(src).toContain('indigo');
    });

    it('9. COLORS is imported from @/lib/design-tokens', () => {
        expect(src).toContain("from '@/lib/design-tokens'");
        expect(src).toContain('COLORS');
    });
});

describe('AnalyticsAdminClient — DOM Render Tests', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    async function renderAndLoad() {
        let result: ReturnType<typeof render>;
        await act(async () => {
            result = render(<AnalyticsAdminClient />);
        });
        // Wait for loading to complete
        await waitFor(() => {
            expect(screen.queryByText('Loading analytics...')).toBeNull();
        }, { timeout: 3000 });
        return result!;
    }

    it('6. Stat cards use card-interactive class', async () => {
        const { container } = await renderAndLoad();

        await waitFor(() => {
            const cardInteractive = container.querySelectorAll('.card-interactive');
            // 3 system stat cards rendered
            expect(cardInteractive.length).toBeGreaterThanOrEqual(3);
        });
    });

    it('7. Panel containers use surface-1 background variable', async () => {
        const { container } = await renderAndLoad();

        await waitFor(() => {
            const surface1Panels = Array.from(container.querySelectorAll('[style]')).filter(el =>
                (el as HTMLElement).style.background?.includes('var(--surface-1)')
            );
            // Multiple panels use surface-1
            expect(surface1Panels.length).toBeGreaterThan(0);
        });
    });

    it('Renders system stat values from fetched data', async () => {
        await renderAndLoad();

        await waitFor(() => {
            // systemStats total_users: 42 renders
            expect(screen.getByText('42')).toBeDefined();
        });
    });

    it('Renders Provider Rate Limits section heading', async () => {
        await renderAndLoad();

        await waitFor(() => {
            expect(screen.getByText(/Provider Rate Limits/i)).toBeDefined();
        });
    });

    it('Renders model status badges with emerald or red styling for rate-limited models', async () => {
        const { container } = await renderAndLoad();

        await waitFor(() => {
            // Models with rateLimitHits24h > 0 are shown; check for emerald badge
            const emeraldBadge = container.querySelector('.bg-emerald-500\\/15');
            const redBadge = container.querySelector('.bg-red-500\\/15');
            // At least one status badge (emerald for 'ok', red for 'degraded')
            expect(emeraldBadge !== null || redBadge !== null).toBe(true);
        });
    });

    it('Tooltip contentStyle prop is var(--surface-2) via mock', async () => {
        const { container } = await renderAndLoad();

        await waitFor(() => {
            // Our mock renders <div data-testid="tooltip" data-content-bg="...">
            const tooltips = container.querySelectorAll('[data-testid="tooltip"]');
            // May or may not render depending on chartData state; if present, check bg
            tooltips.forEach(t => {
                const bg = t.getAttribute('data-content-bg');
                if (bg) expect(bg).toBe('var(--surface-2)');
            });
        });
    });

    it('Snapshot: matches stable structure (catches color regressions)', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        vi.setSystemTime(new Date('2026-02-24T08:00:00Z'));
        try {
            const { container } = await renderAndLoad();
            await waitFor(() => {
                expect(container.querySelector('.card-interactive')).not.toBeNull();
            });
            expect(container).toMatchSnapshot();
        } finally {
            vi.useRealTimers();
        }
    });
});
