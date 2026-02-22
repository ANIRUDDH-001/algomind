// @vitest-environment jsdom
/**
 * CODE-C fix regression: CodeEditor wrapper must use pixel-based height
 * on mobile (< 1024px) and '100%' on desktop (>= 1024px).
 * The Monaco <Editor> always receives height="100%".
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Track Editor props passed to @monaco-editor/react ───
const _capturedEditorProps: Record<string, unknown> = {};

vi.mock('next/dynamic', () => {
    // Return a factory that returns our mock component directly
    return {
        __esModule: true,
        default: (_loader: () => Promise<unknown>) => {
            // Return a component that renders a stub and captures props
            const MockDynamic = (props: Record<string, unknown>) => {
                Object.assign(_capturedEditorProps, props);
                return (
                    <div
                        data-testid="mock-monaco-editor"
                        data-height={props.height as string}
                        data-language={props.language as string}
                    >
                        Monaco Editor Stub
                    </div>
                );
            };
            MockDynamic.displayName = 'MockDynamicEditor';
            return MockDynamic;
        },
    };
});

// ─── Import component under test ───
import { CodeEditor } from '../CodeEditor';

// ─── Helpers ───
function setViewportWidth(width: number) {
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: width,
    });
}

function fireResize() {
    window.dispatchEvent(new Event('resize'));
}

// ─── Tests ───
describe('CodeEditor height (CODE-C fix)', () => {
    const onCodeChange = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        for (const key in _capturedEditorProps) delete _capturedEditorProps[key];
    });

    it('Mobile viewport (390px): wrapper has calc(100dvh - 320px) height', () => {
        setViewportWidth(390);

        const { container } = render(<CodeEditor onCodeChange={onCodeChange} />);

        // The wrapper div around <Editor> has style.height set
        const editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper).toBeDefined();
        expect(editorWrapper!.getAttribute('style')).toContain('calc(100dvh - 320px)');
    });

    it('Desktop viewport (1440px): wrapper has height 100%', () => {
        setViewportWidth(1440);

        const { container } = render(<CodeEditor onCodeChange={onCodeChange} />);

        const editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper).toBeDefined();
        expect(editorWrapper!.getAttribute('style')).toContain('100%');
    });

    it('Window resize from mobile → desktop: height updates correctly', () => {
        // Start at mobile
        setViewportWidth(390);
        const { container } = render(<CodeEditor onCodeChange={onCodeChange} />);

        let editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('calc(100dvh - 320px)');

        // Resize to desktop
        act(() => {
            setViewportWidth(1440);
            fireResize();
        });

        editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('100%');
    });

    it('Window resize from desktop → mobile: height updates correctly', () => {
        // Start at desktop
        setViewportWidth(1440);
        const { container } = render(<CodeEditor onCodeChange={onCodeChange} />);

        let editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('100%');

        // Resize to mobile
        act(() => {
            setViewportWidth(390);
            fireResize();
        });

        editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('calc(100dvh - 320px)');
    });

    it('Monaco <Editor> component receives height="100%" prop', () => {
        setViewportWidth(390);
        render(<CodeEditor onCodeChange={onCodeChange} />);

        // The mock captured the props — verify height="100%"
        const editors = screen.getAllByTestId('mock-monaco-editor');
        expect(editors.length).toBeGreaterThan(0);
        // Every instance should have height="100%" (Monaco always gets 100%)
        editors.forEach(editor => {
            expect(editor.getAttribute('data-height')).toBe('100%');
        });
    });

    it('Breakpoint threshold is exactly 1024px', () => {
        // At 1023px = mobile
        setViewportWidth(1023);
        const { container, unmount } = render(<CodeEditor onCodeChange={onCodeChange} />);

        let editorWrapper = container.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('calc(100dvh - 320px)');
        unmount();

        // At 1024px = desktop
        setViewportWidth(1024);
        const { container: container2 } = render(<CodeEditor onCodeChange={onCodeChange} />);

        editorWrapper = container2.querySelector('[style*="height"]');
        expect(editorWrapper!.getAttribute('style')).toContain('100%');
    });
});
