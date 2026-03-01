// @vitest-environment jsdom
/**
 * CODE-I fix regression: CompanyModeSelector should fetch company
 * profiles exactly once (fetchedRef guard) and gracefully fall back
 * to DEFAULT_COMPANIES when Supabase returns an error or empty data.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Track calls to the supabase chain ───
let mockSelectImpl: () => { order: () => Promise<{ data: unknown[] | null; error: unknown }> };
let fetchCallCount = 0;

vi.mock('@/lib/supabase/client', () => ({
    getSupabase: () => ({
        from: (_table: string) => {
            fetchCallCount++;
            return {
                select: () => ({
                    order: () => ({
                        ...mockSelectImpl().order(),
                        abortSignal: () => mockSelectImpl().order(),
                    }),
                }),
            };
        },
    }),
    isSupabaseConfigured: () => true,
}));

// ─── Import component ───
import { CompanyModeSelector } from '../CompanyModeSelector';

const DEFAULT_COMPANY_NAMES = ['General', 'Google', 'Meta', 'Amazon', 'Startup'];

// ─── Tests ───
describe('CompanyModeSelector (CODE-I fix)', () => {
    beforeEach(() => {
        fetchCallCount = 0;
        // Default: return error (table missing)
        mockSelectImpl = () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'relation "company_profiles" does not exist', code: '42P01' } }),
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('calls fetchProfiles exactly once on initial mount', async () => {
        const onSelect = vi.fn();
        render(<CompanyModeSelector selectedCompany={null} onSelect={onSelect} />);

        // Wait for loading to finish
        await waitFor(() => {
            expect(screen.queryByText('General')).toBeDefined();
        });

        expect(fetchCallCount).toBe(1);
    });

    it('does NOT re-fetch on parent re-renders (fetchedRef guard)', async () => {
        const onSelect = vi.fn();

        function Wrapper() {
            const [count, setCount] = React.useState(0);
            return (
                <>
                    <button data-testid="rerender-btn" onClick={() => setCount(c => c + 1)}>
                        Rerender ({count})
                    </button>
                    <CompanyModeSelector selectedCompany={null} onSelect={onSelect} />
                </>
            );
        }

        render(<Wrapper />);

        // Wait for initial load
        await waitFor(() => {
            expect(screen.getAllByText('General').length).toBeGreaterThan(0);
        });

        const initialFetchCount = fetchCallCount;

        // Re-render parent 4 times
        for (let i = 0; i < 4; i++) {
            await act(async () => {
                fireEvent.click(screen.getByTestId('rerender-btn'));
            });
        }

        // fetchProfiles should still only have been called once
        expect(fetchCallCount).toBe(initialFetchCount);
    });

    it('shows DEFAULT_COMPANIES when Supabase returns 404 (table missing)', async () => {
        // mockSelectImpl already returns error (default in beforeEach)
        const onSelect = vi.fn();
        const { container } = render(<CompanyModeSelector selectedCompany={null} onSelect={onSelect} />);

        // Wait for loading to finish and companies to render
        await waitFor(() => {
            expect(screen.getAllByText('General').length).toBeGreaterThan(0);
        });

        // All default companies should be visible
        for (const name of DEFAULT_COMPANY_NAMES) {
            expect(screen.getAllByText(name).length).toBeGreaterThan(0);
        }

        // No error thrown — component rendered successfully
        expect(container.textContent).not.toContain('Error');
    });

    it('renders company list from Supabase data', async () => {
        const dbCompanies = [
            { id: 'acme', name: 'Acme Corp', emoji: '🏭', theme_color: 'blue', persona_prompt: 'Acme prompt' },
            { id: 'widgetco', name: 'WidgetCo', emoji: '⚙️', theme_color: 'green', persona_prompt: 'Widget prompt' },
        ];

        mockSelectImpl = () => ({
            order: () => Promise.resolve({ data: dbCompanies, error: null }),
        });

        const onSelect = vi.fn();
        render(<CompanyModeSelector selectedCompany={null} onSelect={onSelect} />);

        // Wait for data to load
        await waitFor(() => {
            expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
        });

        // DB companies rendered
        expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
        expect(screen.getAllByText('WidgetCo').length).toBeGreaterThan(0);

        // General should be prepended (since DB data doesn't include it)
        expect(screen.getAllByText('General').length).toBeGreaterThan(0);
    });

    it('calls onSelect with correct company id when user clicks', async () => {
        const dbCompanies = [
            { id: 'acme', name: 'Acme Corp', emoji: '🏭', theme_color: 'blue', persona_prompt: 'Acme prompt' },
        ];
        mockSelectImpl = () => ({
            order: () => Promise.resolve({ data: dbCompanies, error: null }),
        });

        const onSelect = vi.fn();
        render(<CompanyModeSelector selectedCompany={null} onSelect={onSelect} />);

        // Wait for companies to load
        await waitFor(() => {
            expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0);
        });

        // Clear any mount-time onSelect calls
        onSelect.mockClear();

        // Click the "Acme Corp" button
        const acmeBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('Acme Corp'));
        expect(acmeBtn).toBeDefined();
        fireEvent.click(acmeBtn!);

        // onSelect called with the company id and persona
        expect(onSelect).toHaveBeenCalledWith('acme', 'Acme prompt');
    });

    it('calls onSelect(null, null) when "General" is clicked', async () => {
        mockSelectImpl = () => ({
            order: () => Promise.resolve({ data: null, error: { message: 'not found' } }),
        });

        const onSelect = vi.fn();
        render(<CompanyModeSelector selectedCompany={null} onSelect={onSelect} />);

        await waitFor(() => {
            expect(screen.getAllByText('General').length).toBeGreaterThan(0);
        });

        // Clear any mount-time calls
        onSelect.mockClear();

        // Click General
        const generalBtn = screen.getAllByRole('button').find(b => b.textContent?.includes('General'));
        expect(generalBtn).toBeDefined();
        fireEvent.click(generalBtn!);

        expect(onSelect).toHaveBeenCalledWith(null, null);
    });
});
