import { ReactNode } from 'react';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { requireAdmin } from '@/lib/auth/is-admin';

export default async function AdminLayout({ children }: { children: ReactNode }) {
    // Basic server-side guard for the entire admin section layout.
    await requireAdmin();

    return (
        <div className="min-h-screen bg-[var(--surface-base)]">
            {/* Main Content Area */}
            <main className="max-w-[1400px] mx-auto p-6 md:p-10 w-full relative">
                <div className="mb-6">
                    <h1 className="text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500 flex items-center gap-3">
                        Admin Console
                    </h1>
                    <p className="text-zinc-400 mt-2 font-medium">
                        System-level management and oversight.
                    </p>
                </div>

                <AdminTabsNav />
                <div className="flex-1">
                    {children}
                </div>
            </main>
        </div>
    );
}
