import { requireAdmin } from '@/lib/auth/is-admin';
import KnowledgeAdminClient from './client';

export default async function KnowledgeAdminPage() {
    await requireAdmin(); // Redirects if not admin
    return <KnowledgeAdminClient />;
}
