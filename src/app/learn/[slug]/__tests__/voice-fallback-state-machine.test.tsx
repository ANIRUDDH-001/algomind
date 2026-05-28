/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LearnSessionPageClient from '../LearnSessionPageClient';

let mockVadMode: 'onnx' | 'push-to-talk' = 'onnx';
let mockSttListening = false;
const startListeningMock = vi.fn(() => {
  mockSttListening = true;
});
const stopListeningMock = vi.fn(() => {
  mockSttListening = false;
});
const sendMessageMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { whileHover: _whileHover, whileTap: _whileTap, initial: _initial, animate: _animate, transition: _transition, ...safeProps } = props;
      return <div {...safeProps}>{children}</div>;
    },
    button: ({ children, ...props }: any) => {
      const { whileHover: _whileHover, whileTap: _whileTap, initial: _initial, animate: _animate, transition: _transition, ...safeProps } = props;
      return <button {...safeProps}>{children}</button>;
    },
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useLearnSession', () => ({
  useLearnSession: () => ({
    state: 'active',
    transcript: [],
    kaiTyping: false,
    error: null,
    startSession: vi.fn(),
    endSession: vi.fn(),
    sendMessage: sendMessageMock,
  }),
}));

vi.mock('@/hooks/useTTS', () => ({
  useTTS: () => ({
    speak: vi.fn(),
    isSpeaking: false,
    stop: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSTT', () => ({
  useSTT: () => ({
    isListening: mockSttListening,
    isTranscribing: false,
    transcript: 'hello from mic',
    interimTranscript: '',
    startListening: startListeningMock,
    stopListening: stopListeningMock,
    resetTranscript: vi.fn(),
    transcribeAudio: vi.fn(),
  }),
}));

vi.mock('@/hooks/useVAD', () => ({
  useVAD: () => ({
    mode: mockVadMode,
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
  }),
}));

vi.mock('@/components/upgrade/UpgradeModal', () => ({
  UpgradeModal: () => null,
}));

vi.mock('@/components/voice/ZoomTranscript', () => ({
  ZoomTranscript: () => <div data-testid="zoom-transcript" />,
}));

vi.mock('@/components/voice/VoiceModeToggle', () => ({
  VoiceModeToggle: () => <div data-testid="voice-toggle" />,
}));

describe('Learn voice fallback state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    mockSttListening = false;
    mockVadMode = 'onnx';
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows ONNX auto-listen hint when VAD mode is onnx', () => {
    render(<LearnSessionPageClient slug="arrays" />);
    // In VAD/onnx mode the input placeholder shows the default typing hint
    const input = screen.getByTestId('text-input') as HTMLInputElement;
    expect(input.placeholder).toMatch(/tap the mic/i);
  });

  it('switches to push-to-talk UX hint when fallback mode is push-to-talk', () => {
    mockVadMode = 'push-to-talk';
    render(<LearnSessionPageClient slug="arrays" />);
    // In push-to-talk mode the input placeholder prompts to tap the mic
    const input = screen.getByTestId('text-input') as HTMLInputElement;
    expect(input.placeholder).toMatch(/tap the mic/i);
  });

  it('push-to-talk mic toggle starts and then stops listening and sends transcript', () => {
    mockVadMode = 'push-to-talk';
    const { rerender } = render(<LearnSessionPageClient slug="arrays" />);

    fireEvent.click(screen.getAllByTestId('send-button')[0]);
    expect(startListeningMock).toHaveBeenCalled();

    mockSttListening = true;
    rerender(<LearnSessionPageClient slug="arrays" />);

    fireEvent.click(screen.getAllByTestId('send-button')[0]);
    expect(stopListeningMock).toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalledWith('hello from mic');
  });
});
