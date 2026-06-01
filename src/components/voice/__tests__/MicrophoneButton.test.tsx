/**
 * @codesage
 * @file      src/components/voice/__tests__/MicrophoneButton.test.tsx
 * @purpose   Tests for MicrophoneButton interaction and states.
 * @tech      Vitest, React Testing Library
 * @connects  ../MicrophoneButton
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1 | @skip: test-file
 */
// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MicrophoneButton } from '@/components/voice/MicrophoneButton';

// Mock framer-motion to just pass children through, no animations
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, className, 'data-testid': testId }: any) => (
            <div className={className} data-testid={testId}>{children}</div>
        ),
        button: ({ children, className, onClick, disabled, 'data-testid': testId }: any) => (
            <button
                className={className}
                onClick={onClick}
                disabled={disabled}
                data-testid={testId}
            >
                {children}
            </button>
        ),
        span: ({ children, className, 'data-testid': testId }: any) => (
            <span className={className} data-testid={testId}>{children}</span>
        ),
    }
}));

// Mock lucide-react icons for easier assertion
vi.mock('lucide-react', () => ({
    Mic: () => <svg data-testid="icon-mic" />,
    MicOff: () => <svg data-testid="icon-mic-off" />,
    AlertCircle: () => <svg data-testid="icon-alert" />
}));

describe('MicrophoneButton', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('1. Renders mic-off icon when isListening=false', () => {
        render(<MicrophoneButton isListening={false} onClick={() => { }} />);
        expect(screen.getByTestId('icon-mic-off')).toBeDefined();
        expect(screen.queryByTestId('icon-mic')).toBeNull();
    });

    it('2. Renders mic icon when isListening=true', () => {
        render(<MicrophoneButton isListening={true} onClick={() => { }} />);
        expect(screen.getByTestId('icon-mic')).toBeDefined();
        expect(screen.queryByTestId('icon-mic-off')).toBeNull();
    });

    it('3. Renders AlertCircle icon when error is provided', () => {
        render(<MicrophoneButton isListening={false} error="Test Error" onClick={() => { }} />);
        expect(screen.getByTestId('icon-alert')).toBeDefined();
        expect(screen.queryByTestId('icon-mic')).toBeNull();
        expect(screen.queryByTestId('icon-mic-off')).toBeNull();
    });

    it('4. Clicking calls onClick', () => {
        const onClick = vi.fn();
        render(<MicrophoneButton isListening={false} onClick={onClick} />);
        fireEvent.click(screen.getByTestId('mic-button'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('5. Button is disabled when disabled=true prop passed', () => {
        const onClick = vi.fn();
        render(<MicrophoneButton isListening={false} disabled={true} onClick={onClick} />);
        const button = screen.getByTestId('mic-button');
        expect((button as HTMLButtonElement).disabled).toBe(true);

        fireEvent.click(button);
        expect(onClick).not.toHaveBeenCalled();
    });

    it('6. Button has data-testid="mic-button"', () => {
        render(<MicrophoneButton isListening={false} onClick={() => { }} />);
        expect(screen.getByTestId('mic-button')).toBeDefined();
    });

    it('7. State label shows "Listening..." when isListening=true', () => {
        render(<MicrophoneButton isListening={true} onClick={() => { }} />);
        expect(screen.getByText('Listening...')).toBeDefined();
    });

    it('8. State label shows "Click to speak" when isListening=false', () => {
        render(<MicrophoneButton isListening={false} onClick={() => { }} />);
        expect(screen.getByText('Click to speak')).toBeDefined();
    });

    it('9. State label shows "Mic error" when error is provided', () => {
        render(<MicrophoneButton isListening={false} error="Some error" onClick={() => { }} />);
        expect(screen.getByText('Mic error')).toBeDefined();
    });

    it('10. Three ring animations are present in DOM when isListening=true', () => {
        const { container } = render(<MicrophoneButton isListening={true} onClick={() => { }} />);
        // Look for the div containing the rings
        // The rings have className="absolute rounded-full border border-indigo-400/20"
        const rings = container.querySelectorAll('.border-indigo-400\\/20');
        expect(rings).toHaveLength(3);
    });

    it('11. No ring animations when isListening=false', () => {
        const { container } = render(<MicrophoneButton isListening={false} onClick={() => { }} />);
        const rings = container.querySelectorAll('.border-indigo-400\\/20');
        expect(rings).toHaveLength(0);
    });

    it('12. Snapshot test: idle state', () => {
        const { container } = render(<MicrophoneButton isListening={false} onClick={() => { }} />);
        expect(container).toMatchSnapshot();
    });

    it('13. Snapshot test: listening state', () => {
        const { container } = render(<MicrophoneButton isListening={true} onClick={() => { }} />);
        expect(container).toMatchSnapshot();
    });

    it('14. Snapshot test: error state', () => {
        const { container } = render(<MicrophoneButton isListening={false} error="Failed to connect" onClick={() => { }} />);
        expect(container).toMatchSnapshot();
    });
});
