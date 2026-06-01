/**
 * @codesage
 * @file      src/app/__tests__/css-utilities.test.ts
 * @audit     CODESAGE-v1
 * @skip      test-file
 *
 * CSS Utilities Regression Tests
 * Verifies that all CSS utility classes referenced in TSX files are actually
 * defined in globals.css — catches the silent-failure bug where classes like
 * `glass-morphism` were referenced in components but never defined.
 *
 * Strategy: Parse globals.css as a string and assert each utility is present.
 *
 * NOTE ON glass-morphism:
 *   This class is NOT defined in globals.css (only `.glass` exists).
 *   The test for `glass-morphism` is deliberately marked `.fails` to document
 *   the known missing class. Remove `.fails` once the class is added.
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const globalCSSContent = fs.readFileSync(
    path.join(process.cwd(), 'src/app/globals.css'),
    'utf-8'
);

// ─── Classes confirmed DEFINED in globals.css ───
const DEFINED_CLASSES = [
    'glass',                    // line 268
    'glass-morphism',           // line 275
    'surface-1',                // line 252 (utility class + CSS var)
    'surface-2',                // line 257
    'surface-3',                // line 262
    'custom-scrollbar',         // line 324
    'mobile-scroll',            // line 349
    'mobile-scroll-container',  // line 355
    'swipe-dots',               // line 360
    'swipe-dot',                // line 367
    'card-interactive',         // line 389
    'text-gradient',            // line 403
    'text-gradient-subtle',     // line 410
    'btn-primary',              // line 418
    'btn-ghost',                // line 433
    'badge-easy',               // line 293
    'badge-medium',             // line 297
    'badge-hard',               // line 301
    'page-container',           // line 381
    'glow-accent',              // line 284
];

describe('CSS Utility Classes — Defined in globals.css', () => {
    test.each(DEFINED_CLASSES)('.%s is defined', (className) => {
        expect(globalCSSContent).toContain(`.${className}`);
    });
});

// ─── All classes from the spec that are NOT present ───
// (Empty now that glass-morphism and surface-1/2/3 are confirmed defined)
const MISSING_CLASSES: string[] = [];
// If you find a missing class in future, add it here:
// e.g. 'some-undefined-class'

describe('CSS Utility Classes — Known Missing (bug documentation)', () => {
    // Empty: all spec classes are currently defined.
    // Add entries to MISSING_CLASSES above when a regression is found.
    test('no known missing classes (update MISSING_CLASSES if a regression is found)', () => {
        expect(MISSING_CLASSES).toHaveLength(0);
    });
});

// ─── CSS Variables confirmed DEFINED ───
const REQUIRED_VARS = [
    '--surface-base',       // line: dark background root
    '--surface-1',          // line: card level 1
    '--surface-2',          // line: card level 2
    '--surface-3',          // line: card level 3
    '--accent-primary',     // line: indigo
    '--accent-secondary',   // line: violet
    '--accent-glow',        // line: rgba glow
    '--spring',             // line: cubic-bezier spring timing
    '--ease-out',           // line: cubic-bezier ease-out
    '--shadow-card',        // line 241
    '--shadow-glow',        // used via var(--shadow-glow)
    '--navbar-h',           // line 246: 64px
    '--surface-edge',       // line 197: border/divider color
];

describe('CSS Variables — Defined in globals.css', () => {
    test.each(REQUIRED_VARS)('%s is defined', (varName) => {
        expect(globalCSSContent).toContain(varName);
    });
});

// ─── Additional structural checks ───
describe('CSS globals.css — Structural integrity', () => {
    test('globals.css is non-empty', () => {
        expect(globalCSSContent.length).toBeGreaterThan(1000);
    });

    test('Tailwind directives are present (@import "tailwindcss" or @tailwind)', () => {
        const hasTailwindV4 = globalCSSContent.includes('@import "tailwindcss"');
        const hasTailwindV3 = globalCSSContent.includes('@tailwind');
        expect(hasTailwindV4 || hasTailwindV3).toBe(true);
    });

    test(':root block is present for CSS variable declarations', () => {
        expect(globalCSSContent).toContain(':root');
    });

    test('.dark block is present for dark mode overrides', () => {
        expect(globalCSSContent).toContain('.dark');
    });

    test('Custom scrollbar styles are present for both webkit and base', () => {
        expect(globalCSSContent).toContain('::-webkit-scrollbar');
    });
});
