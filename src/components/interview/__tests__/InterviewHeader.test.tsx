/**
 * @codesage
 * @file      src/components/interview/__tests__/InterviewHeader.test.tsx
 * @purpose   Tests for InterviewHeader component.
 * @tech      Vitest, React Testing Library
 * @connects  ../InterviewHeader
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { InterviewHeader } from '../InterviewHeader';

afterEach(() => {
  cleanup();
});

describe('InterviewHeader mode badge', () => {
  it('shows correct label for each mode', () => {
    const modes = [
      { mode: 'warm-up' as const, label: 'Warm Up' },
      { mode: 'practice' as const, label: 'Practice' },
      { mode: 'crunch' as const, label: 'Crunch' },
      { mode: 'sprint' as const, label: 'Sprint' },
      { mode: 'employer' as const, label: 'Assessment' },
    ];

    modes.forEach(({ mode, label }) => {
      const { getByTestId, unmount } = render(
        <InterviewHeader
          problemTitle="Two Sum"
          difficulty="easy"
          mode={mode}
          conceptTags={[]}
        />
      );
      expect(getByTestId('mode-badge').textContent).toContain(label);
      unmount();
    });
  });

  it('shows concept tags when provided', () => {
    const { getAllByTestId, getByText } = render(
      <InterviewHeader
        problemTitle="Two Sum"
        difficulty="easy"
        mode="practice"
        conceptTags={['two-pointers', 'hash-map']}
      />
    );

    const tags = getAllByTestId('concept-tag');
    expect(tags).toHaveLength(2);
    expect(getByText('two pointers')).not.toBeNull();
    expect(getByText('hash map')).not.toBeNull();
  });

  it('shows no tags when conceptTags is empty', () => {
    const { container } = render(
      <InterviewHeader
        problemTitle="Two Sum"
        difficulty="easy"
        mode="practice"
        conceptTags={[]}
      />
    );

    expect(container.querySelectorAll('[data-testid="concept-tag"]')).toHaveLength(0);
  });
});
