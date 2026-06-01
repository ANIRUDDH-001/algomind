/**
 * @codesage
 * @file      src/app/owner/tabs/admins-tab.tsx
 * @purpose   Displays the Admins tab in the owner dashboard.
 * @tech      React
 * @connects  Imports AdminsClient from app/admin
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
'use client';

// Reuse the existing admin component for now, but embedded directly into the tab structure.
import AdminsClient from '@/app/admin/client';

export function AdminsTab() {
    return (
        <div className="bg-[var(--surface-0)] border border-[var(--surface-edge)] rounded-2xl overflow-hidden shadow-2xl">
            <AdminsClient />
        </div>
    );
}
