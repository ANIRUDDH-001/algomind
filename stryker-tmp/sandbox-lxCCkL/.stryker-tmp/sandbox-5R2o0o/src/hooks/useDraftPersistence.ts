/**
 * @codesage
 * @file      src/hooks/useDraftPersistence.ts
 * @purpose   React hook to persist form field values to sessionStorage with debouncing.
 * @tech      React, DOM Storage
 * @connects  Exported for use in form components across the app
 * @apis      none
 * @db        none
 * @state     React component state synced with browser sessionStorage
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { useState, useEffect, useCallback } from 'react';

/**
 * Persist form field value to sessionStorage.
 * Auto-clears on explicit submit.
 */
export function useDraftPersistence(
    key: string,
    initialValue: string = ''
): [string, (value: string) => void, () => void] {
    const storageKey = `draft:${key}`;

    const [value, setValue] = useState<string>(() => {
        if (typeof window === 'undefined') return initialValue;
        try {
            return sessionStorage.getItem(storageKey) || initialValue;
        } catch {
            return initialValue;
        }
    });

    // Debounced save to sessionStorage
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const timeout = setTimeout(() => {
            try {
                if (value) {
                    sessionStorage.setItem(storageKey, value);
                } else {
                    sessionStorage.removeItem(storageKey);
                }
            } catch {
                // Quota exceeded or storage unavailable; ignore persistence failures.
            }
        }, 500);

        return () => clearTimeout(timeout);
    }, [value, storageKey]);

    // Clear draft (call on successful submit)
    const clearDraft = useCallback(() => {
        try {
            sessionStorage.removeItem(storageKey);
        } catch {
            // Ignore storage cleanup failures.
        }
        setValue('');
    }, [storageKey]);

    return [value, setValue, clearDraft];
}
