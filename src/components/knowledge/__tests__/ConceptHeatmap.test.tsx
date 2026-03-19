/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConceptHeatmap } from '../ConceptHeatmap';
import { ConceptTile } from '../ConceptTile';
import type { KGConceptSummary } from '@/lib/knowledge-graph';

const useConceptHeatmapMock = vi.fn();
const routerPushMock = vi.fn();

vi.mock('@/hooks/useConceptHeatmap', () => ({
  useConceptHeatmap: () => useConceptHeatmapMock(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, style, onClick, 'data-testid': testId }: any) => (
      <div className={className} style={style} onClick={onClick} data-testid={testId}>{children}</div>
    ),
    button: ({ children, className, style, onClick, title, type, 'data-testid': testId }: any) => (
      <button type={type ?? 'button'} className={className} style={style} onClick={onClick} title={title} data-testid={testId}>
        {children}
      </button>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('lucide-react', () => ({
  Sparkles: () => <svg data-testid="icon-sparkles" />,
  AlertCircle: () => <svg data-testid="icon-alert-circle" />,
  X: () => <svg data-testid="icon-x" />,
  Play: () => <svg data-testid="icon-play" />,
  BookOpen: () => <svg data-testid="icon-book" />,
  TrendingUp: () => <svg data-testid="icon-trending-up" />,
  TrendingDown: () => <svg data-testid="icon-trending-down" />,
}));

const mockConcepts: KGConceptSummary[] = [
  { slug: 'arrays-strings', displayName: 'Arrays', confidence: 0.2, level: 'weak', evidenceCount: 3, icon: '[]', lastSessionType: 'interview', lastSignalAt: null },
  { slug: 'hashmaps-sets', displayName: 'HashMaps', confidence: 0.8, level: 'strong', evidenceCount: 5, icon: '{}', lastSessionType: null, lastSignalAt: null },
  { slug: 'two-pointers', displayName: 'Two Pointers', confidence: 0.5, level: 'developing', evidenceCount: 2, icon: '>>', lastSessionType: 'learn', lastSignalAt: null },
  { slug: 'sliding-window', displayName: 'Sliding Window', confidence: 0.7, level: 'solid', evidenceCount: 4, icon: '<>', lastSessionType: null, lastSignalAt: null },
  { slug: 'binary-search', displayName: 'Binary Search', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'recursion-backtracking', displayName: 'Recursion', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'trees-traversal', displayName: 'Trees', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'graphs-bfs-dfs', displayName: 'Graphs', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'dynamic-programming', displayName: 'DP', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'heaps', displayName: 'Heaps', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'tries', displayName: 'Tries', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'sorting-algorithms', displayName: 'Sorting', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'linked-lists', displayName: 'Linked Lists', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'bit-manipulation', displayName: 'Bit Manipulation', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'math-number-theory', displayName: 'Math', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'stack-queue', displayName: 'Stack Queue', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'intervals', displayName: 'Intervals', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'matrix', displayName: 'Matrix', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'prefix-sum', displayName: 'Prefix Sum', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
  { slug: 'union-find', displayName: 'Union Find', confidence: 0, level: 'unknown', evidenceCount: 0, icon: '?', lastSessionType: null, lastSignalAt: null },
];

describe('ConceptHeatmap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConceptHeatmapMock.mockReturnValue({
      concepts: mockConcepts,
      isLoading: false,
      error: null,
      hasCompletedDiagnostic: true,
      weakestConcept: mockConcepts[0],
      strongestConcept: mockConcepts[1],
      refresh: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders 20 tiles when concepts loaded', () => {
    const { container } = render(<ConceptHeatmap />);
    expect(container.querySelectorAll('[data-testid^="concept-tile-"]').length).toBe(20);
  });

  it('shows loading skeletons while fetching', () => {
    useConceptHeatmapMock.mockReturnValueOnce({
      concepts: [],
      isLoading: true,
      error: null,
      hasCompletedDiagnostic: false,
      weakestConcept: null,
      strongestConcept: null,
      refresh: vi.fn(),
    });

    render(<ConceptHeatmap />);
    expect(screen.getAllByTestId('concept-heatmap-skeleton').length).toBe(20);
  });

  it('shows error state when fetch fails', () => {
    useConceptHeatmapMock.mockReturnValueOnce({
      concepts: [],
      isLoading: false,
      error: 'boom',
      hasCompletedDiagnostic: false,
      weakestConcept: null,
      strongestConcept: null,
      refresh: vi.fn(),
    });

    render(<ConceptHeatmap />);
    expect(screen.getByText('Could not load concept data')).toBeDefined();
  });

  it('shows diagnostic prompt for new users', () => {
    useConceptHeatmapMock.mockReturnValueOnce({
      concepts: mockConcepts,
      isLoading: false,
      error: null,
      hasCompletedDiagnostic: false,
      weakestConcept: null,
      strongestConcept: null,
      refresh: vi.fn(),
    });

    render(<ConceptHeatmap />);
    expect(screen.getByText('Take Diagnostic ->')).toBeDefined();
  });

  it('opens detail panel when tile clicked', () => {
    render(<ConceptHeatmap />);
    fireEvent.click(screen.getByTestId('concept-tile-arrays-strings'));
    expect(screen.getByTestId('concept-detail-panel')).toBeDefined();
  });

  it('closes detail panel on backdrop click', () => {
    render(<ConceptHeatmap />);
    fireEvent.click(screen.getByTestId('concept-tile-arrays-strings'));
    fireEvent.click(screen.getByTestId('concept-detail-backdrop'));
    expect(screen.queryByTestId('concept-detail-panel')).toBeNull();
  });

  it('highlights active learning concept', () => {
    render(<ConceptHeatmap activeLearningConceptSlug="arrays-strings" />);
    const tile = screen.getByTestId('concept-tile-arrays-strings');
    expect(tile.className.includes('ring-emerald-500/60')).toBe(true);
  });

  it('shows weakest concept in header', () => {
    render(<ConceptHeatmap />);
    expect(screen.getByText('Focus: Arrays ->')).toBeDefined();
  });
});

describe('ConceptTile', () => {
  const baseConcept = mockConcepts[0];

  afterEach(() => {
    cleanup();
  });

  it('renders concept name and icon', () => {
    render(<ConceptTile concept={baseConcept} index={0} />);
    expect(screen.getByText('Arrays')).toBeDefined();
    expect(screen.getByText('[]')).toBeDefined();
  });

  it('shows confidence percentage when evidence exists', () => {
    render(<ConceptTile concept={baseConcept} index={0} />);
    expect(screen.getByText('20%')).toBeDefined();
  });

  it('shows dash when no evidence', () => {
    render(<ConceptTile concept={mockConcepts[4]} index={0} />);
    expect(screen.getByText('-')).toBeDefined();
  });

  it('applies correct color class for each level', () => {
    const { rerender } = render(<ConceptTile concept={mockConcepts[0]} index={0} />);
    expect(screen.getByTestId('concept-tile-arrays-strings').className.includes('bg-red-950/40')).toBe(true);

    rerender(<ConceptTile concept={mockConcepts[1]} index={1} />);
    expect(screen.getByTestId('concept-tile-hashmaps-sets').className.includes('bg-emerald-950/30')).toBe(true);
  });

  it('shows selected ring when isSelected', () => {
    render(<ConceptTile concept={baseConcept} index={0} isSelected />);
    expect(screen.getByTestId('concept-tile-arrays-strings').className.includes('ring-indigo-500/60')).toBe(true);
  });

  it('shows emerald ring when isActiveLearning', () => {
    render(<ConceptTile concept={baseConcept} index={0} isActiveLearning />);
    expect(screen.getByTestId('concept-tile-arrays-strings').className.includes('ring-emerald-500/60')).toBe(true);
  });

  it('calls onClick with concept on click', () => {
    const onClick = vi.fn();
    render(<ConceptTile concept={baseConcept} index={0} onClick={onClick} />);
    fireEvent.click(screen.getByTestId('concept-tile-arrays-strings'));
    expect(onClick).toHaveBeenCalledWith(baseConcept);
  });
});
