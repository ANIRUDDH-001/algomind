// Client-side entry code formatting and validation utilities

export const ENTRY_CODE_REGEX = /^[A-Z]{3}-[2-9]{3}-[A-Z]{3}$/;

export function formatEntryCode(raw: string): string {
    // Clean and uppercase input, auto-insert dashes
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length <= 3) return clean;
    if (clean.length <= 6) return `${clean.slice(0, 3)}-${clean.slice(3)}`;
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
}

export function isValidEntryCodeFormat(code: string): boolean {
    return ENTRY_CODE_REGEX.test(code.toUpperCase().trim());
}
