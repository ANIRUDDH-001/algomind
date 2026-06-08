/**
 * @codesage
 * @file      src/components/voice/__tests__/LiveTranscript.test.tsx
 * @purpose   Tests for LiveTranscript component.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, LiveTranscript
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
// @vitest-environment jsdom
// @ts-expect-error -- automated unused local suppression
import { render, screen, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveTranscript } from '../LiveTranscript';

// Mock framer-motion to avoid animation-related failures in JSDOM
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
        span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('LiveTranscript', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders nothing when no entries', () => {
    // @ts-expect-error -- automated unused local suppression
    const { container } = render(<LiveTranscript entries={[]} isVisible={true} />);
    // Since we mock motion.div, it might render the wrapper div but it should be empty
    expect(screen.queryByText('Kai')).toBeNull();
    expect(screen.queryByText('You')).toBeNull();
  });

  it('shows last 2 entries from sliding window', async () => {
    render(<LiveTranscript
      entries={[
        { role: 'assistant', content: 'First message' },
        { role: 'user', content: 'Second message' },
        { role: 'assistant', content: 'Third message' },
      ]}
      isVisible={true}
    />);
    
    // Should show Second and Third, not First
    expect(screen.queryByText('First message')).toBeNull();
    expect(screen.getByText(/Second message/)).toBeDefined();
    expect(screen.getByText(/Third message/)).toBeDefined();
  });

  it('shows interim transcript with cursor', () => {
    render(<LiveTranscript entries={[]} interimTranscript="hello there" isVisible={true} />);
    expect(screen.getByText(/hello there/)).toBeDefined();
  });

  it('hides when isVisible=false', () => {
    // @ts-expect-error -- automated unused local suppression
    const { container } = render(<LiveTranscript entries={[{ role: 'user', content: 'test' }]} isVisible={false} />);
    expect(screen.queryByText(/test/)).toBeNull();
  });

  it('labels assistant entries with "Kai"', () => {
    render(<LiveTranscript entries={[{ role: 'assistant', content: 'Hello student' }]} isVisible={true} />);
    expect(screen.getByText('Kai')).toBeDefined();
  });

  it('labels user entries with "You"', () => {
    render(<LiveTranscript entries={[{ role: 'user', content: 'My answer' }]} isVisible={true} />);
    // In LiveTranscript.tsx, role === 'user' uses 'You'
    expect(screen.getByText('You')).toBeDefined();
  });
});