/**
 * @codesage
 * @file      src/lib/campaign/entry-code.ts
 * @purpose   Campaign code verification and timer handling.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

// Client-side entry code formatting and validation utilities

// Correct validation regex for format: AAA-NNN-AAA
// Letters: A-H, J-N, P-Z (no I or O)
// Digits: 2-9 (no 0 or 1)
export const ENTRY_CODE_REGEX = /^[A-HJ-NP-Z]{3}-[2-9]{3}-[A-HJ-NP-Z]{3}$/;

export function formatEntryCode(raw: string): string {
    // Filter to only characters valid in entry codes (matches ENTRY_CODE_REGEX):
    // Letters: A-H, J-N, P-Z (no I or O — visually ambiguous)
    // Digits: 2-9 (no 0 or 1 — visually ambiguous)
    const clean = raw.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

export function isValidEntryCodeFormat(code: string): boolean {
    return ENTRY_CODE_REGEX.test(code.toUpperCase().trim());
}
