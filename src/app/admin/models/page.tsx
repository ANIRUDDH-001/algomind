import { requireAdmin } from '@/lib/auth/is-admin';
import ModelsAdminClient from './client';

export default async function ModelsAdminPage() {
    await requireAdmin(); // Redirects if not admin
    return <ModelsAdminClient />;
}
