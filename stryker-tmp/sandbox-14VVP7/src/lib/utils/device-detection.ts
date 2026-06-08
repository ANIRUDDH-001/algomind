// @ts-nocheck
'use client';
/**
 * @codesage
 * @file      src/lib/utils/device-detection.ts
 * @purpose   Provides core utility and library functions.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */

export function isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;

    const width = window.innerWidth;
    const userAgent = navigator.userAgent.toLowerCase();

    const isMobileUA = /iphone|ipad|ipod|android|blackberry|windows phone/i.test(userAgent);
    const isSmallScreen = width < 768;

    return isMobileUA || isSmallScreen;
}

export function getDeviceName(): string {
    if (typeof window === 'undefined') return 'Unknown';

    const ua = navigator.userAgent;

    if (/iPhone/i.test(ua)) return 'iPhone';
    if (/iPad/i.test(ua)) return 'iPad';
    if (/Android/i.test(ua)) return 'Android';
    if (/Windows Phone/i.test(ua)) return 'Windows Phone';

    return 'Desktop';
}
