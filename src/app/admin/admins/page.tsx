import { requireAdmin } from '@/lib/auth/is-admin';
import AdminsClient from './client';

export default async function AdminsPage() {
    await requireAdmin(); // Redirects if not admin
    return <AdminsClient />;
}
