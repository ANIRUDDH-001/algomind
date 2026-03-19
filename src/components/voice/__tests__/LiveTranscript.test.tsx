import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LiveTranscript } from '../LiveTranscript';

describe('LiveTranscript', () => {
  it('renders nothing when no entries', () => {
    const { container } = render(<LiveTranscript entries={[]} isVisible={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows last 2 entries from sliding window', () => {
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
    expect(screen.getByText('Second message')).toBeDefined();
    expect(screen.getByText('Third message')).toBeDefined();
  });

  it('shows interim transcript with cursor', () => {
    render(<LiveTranscript entries={[]} interimTranscript="hello there" isVisible={true} />);
    expect(screen.getByText(/hello there/)).toBeDefined();
  });

  it('hides when isVisible=false', () => {
    const { container } = render(<LiveTranscript entries={[{ role: 'user', content: 'test' }]} isVisible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('labels assistant entries with "Kai"', () => {
    render(<LiveTranscript entries={[{ role: 'assistant', content: 'Hello student' }]} isVisible={true} />);
    expect(screen.getByText('Kai')).toBeDefined();
  });

  it('labels user entries with "You"', () => {
    render(<LiveTranscript entries={[{ role: 'user', content: 'My answer' }]} isVisible={true} />);
    expect(screen.getAllByText('You')).toBeDefined();
  });
});