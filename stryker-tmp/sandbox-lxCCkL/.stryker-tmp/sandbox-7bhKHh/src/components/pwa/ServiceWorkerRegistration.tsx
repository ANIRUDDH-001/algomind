/**
 * @codesage
 * @file      src/components/pwa/ServiceWorkerRegistration.tsx
 * @purpose   Registers the PWA service worker on the client side.
 * @tech      React
 * @connects  None
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    No issues found
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('[SW] Registration failed:', error);
      }
    };

    void register();
  }, []);

  return null;
}