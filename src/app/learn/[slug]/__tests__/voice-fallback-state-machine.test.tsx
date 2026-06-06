/**
 * @vitest-environment jsdom
 */
/**
 * @codesage
 * @file      src/app/learn/[slug]/__tests__/voice-fallback-state-machine.test.tsx
 * @purpose   Test suite for the voice fallback state machine in the Learn mode client.
 * @tech      Vitest, React Testing Library
 * @connects  Imports LearnSessionPageClient
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1 | @skip: test-file
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
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  })),
});


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

vi.mock('react-resizable-panels', () => ({
  Group: ({ children }: any) => <div>{children}</div>,
  Panel: ({ children }: any) => <div>{children}</div>,
  Separator: () => <div />,
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
    expect(input.placeholder).toMatch(/Listening for speech/i);
  });

  it('switches to push-to-talk UX hint when fallback mode is push-to-talk', () => {
    mockVadMode = 'push-to-talk';
    render(<LearnSessionPageClient slug="arrays" />);
    // In push-to-talk mode the input placeholder prompts to tap the mic
    const input = screen.getByTestId('text-input') as HTMLInputElement;
    expect(input.placeholder).toMatch(/Listening for speech/i);
    fireEvent.click(screen.getByTitle('Mock Mic Input'));
    expect(stopListeningMock).toHaveBeenCalled();
    expect(sendMessageMock).toHaveBeenCalledWith('hello from mic');
  });
});
