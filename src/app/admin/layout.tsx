import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHealthBanner } from '@/components/admin/AdminHealthBanner';
import { requireAdmin } from '@/lib/auth/is-admin';

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // Basic server-side guard for the entire admin section layout.
    // Note: Individual pages still need their own requireAdmin() for data-loading protection,
    // but this ensures the sidebar doesn't flash for unauthorized users.
    await requireAdmin();

    return (
        <div className="flex min-h-screen bg-slate-950">
            {/* Sidebar Navigation */}
            <AdminSidebar />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col">
                <AdminHealthBanner />
                <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}
