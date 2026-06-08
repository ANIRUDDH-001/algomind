/**
 * @codesage
 * @file      src/components/voice/__tests__/ZoomTranscript.test.tsx
 * @purpose   Tests for ZoomTranscript component.
 * @tech      Vitest, React Testing Library, JSDOM
 * @connects  Vitest, @testing-library/react, ZoomTranscript
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1 | @skip: test-file
 */
// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
// @ts-expect-error -- automated unused local suppression
import { afterEach, describe, it, expect, vi } from 'vitest';
import { ZoomTranscript } from '../ZoomTranscript';

afterEach(() => {
  cleanup();
});

describe('ZoomTranscript', () => {
  const defaultProps = {
    kaiMessage: 'What do you think about how arrays work in memory?',
    userTranscript: '',
    isKaiSpeaking: false,
    isUserSpeaking: false,
    isThinking: false,
    conceptSlug: 'arrays-strings',
    conceptIcon: '📋',
    exchangeCount: 3,
  };

  it('renders Kai message in left-aligned bubble', () => {
    render(<ZoomTranscript {...defaultProps} />);
    expect(screen.getByText(/What do you think/)).toBeInTheDocument();
  });

  it('shows live user transcript when user is speaking', () => {
    render(<ZoomTranscript {...defaultProps} userTranscript="Arrays store data" isUserSpeaking={true} />);
    expect(screen.getByText('Arrays store data')).toBeInTheDocument();
  });

  it('shows thinking state on VoiceActivityIndicator', () => {
    render(<ZoomTranscript {...defaultProps} isThinking={true} />);
    expect(screen.getByText('Thinking…')).toBeInTheDocument();
  });

  it('shows Kai speaking state', () => {
    render(<ZoomTranscript {...defaultProps} isKaiSpeaking={true} />);
    expect(screen.getByText('Kai speaking')).toBeInTheDocument();
  });

  it('shows user speaking state', () => {
    render(<ZoomTranscript {...defaultProps} isUserSpeaking={true} />);
    expect(screen.getAllByText('Listening…').length).toBeGreaterThan(0);
  });

  it('renders exchange dots', () => {
    render(<ZoomTranscript {...defaultProps} exchangeCount={5} />);
    const dots = document.querySelectorAll('.rounded-full.bg-indigo-500\\/60');
    expect(dots.length).toBe(5);
  });

  it('shows placeholder when no transcript and not speaking', () => {
    render(<ZoomTranscript {...defaultProps} />);
    expect(screen.getByText('Speak your answer…')).toBeInTheDocument();
  });

  it('shows history count when sessionHistoryCount > 0', () => {
    render(<ZoomTranscript {...defaultProps} sessionHistoryCount={8} />);
    expect(screen.getByText('8 earlier exchanges')).toBeInTheDocument();
  });
});
