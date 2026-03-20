// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

  // ── Accessibility tests (Phase 3E) ──

  it('has role=log with aria-live=polite on Kai message area', () => {
    render(<ZoomTranscript {...defaultProps} />);
    const log = document.querySelector('[role="log"]');
    expect(log).not.toBeNull();
    expect(log).toHaveAttribute('aria-live', 'polite');
    expect(log).toHaveAttribute('aria-label', 'Conversation transcript');
  });

  it('has aria-live on user transcript area', () => {
    render(<ZoomTranscript {...defaultProps} userTranscript="test" isUserSpeaking={true} />);
    const liveRegion = document.querySelector('[aria-label="Your speech"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
  });

  it('has aria-label on exchange counter', () => {
    render(<ZoomTranscript {...defaultProps} exchangeCount={5} />);
    const counter = document.querySelector('[aria-label="5 exchanges completed"]');
    expect(counter).not.toBeNull();
  });

  it('voice activity indicator has role=status', () => {
    render(<ZoomTranscript {...defaultProps} isKaiSpeaking={true} />);
    const status = document.querySelector('[role="status"]');
    expect(status).not.toBeNull();
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
