/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeInsightsCard } from '../KnowledgeInsightsCard';

// Mock ConceptHeatmap as it has complex child rendering
vi.mock('@/components/knowledge/ConceptHeatmap', () => ({
    ConceptHeatmap: ({ className }: any) => <div data-testid="heatmap" className={className}>Mock Heatmap</div>,
}));

describe('KnowledgeInsightsCard', () => {
    beforeEach(() => {
        cleanup();
    });

    it('renders concept heatmap when expanded', () => {
        render(<KnowledgeInsightsCard />);
        expect(screen.getByTestId('heatmap')).toBeDefined();
        expect(screen.getByText(/Knowledge Map/i)).toBeDefined();
    });

    it('collapses heatmap on header click', async () => {
        render(<KnowledgeInsightsCard />);
        const headerButton = screen.getByRole('button');
        
        // Initially expanded
        expect(screen.queryByTestId('heatmap')).not.toBeNull();
        
        // Click to collapse
        fireEvent.click(headerButton);
        expect(screen.queryByTestId('heatmap')).toBeNull();
    });

    it('expands heatmap on header click', () => {
        render(<KnowledgeInsightsCard />);
        const headerButton = screen.getByRole('button');
        
        // Initial -> Collapse -> Expand
        fireEvent.click(headerButton); // collapse
        expect(screen.queryByTestId('heatmap')).toBeNull();
        
        fireEvent.click(headerButton); // expand
        expect(screen.getByTestId('heatmap')).toBeDefined();
    });
});