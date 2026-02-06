'use client';

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
