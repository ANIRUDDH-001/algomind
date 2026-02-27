'use client';

// Reuse the existing employers component for now, embedded into the tab structure.
import EmployersClient from '@/app/admin/employers/client';

export function EmployersTab() {
    return (
        <div className="bg-[var(--surface-0)] border border-[var(--surface-edge)] rounded-2xl overflow-hidden shadow-2xl">
            <EmployersClient />
        </div>
    );
}
