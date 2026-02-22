import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminMobileNav } from '@/components/admin/AdminMobileNav';
import { AdminHealthBanner } from '@/components/admin/AdminHealthBanner';
import { requireAdmin } from '@/lib/auth/is-admin';

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // Basic server-side guard for the entire admin section layout.
    await requireAdmin();

    return (
        <div className="flex flex-col lg:flex-row min-h-screen bg-slate-950">
            {/* Mobile Header (Visible only on small screens) */}
            <AdminMobileNav />

            {/* Sidebar Navigation (Visible only on desktop) */}
            <AdminSidebar />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col relative">
                <AdminHealthBanner />
                <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}
