import { requireAdmin } from '@/lib/auth/is-admin';
import AnalyticsAdminClient from './client';

export default async function AnalyticsAdminPage() {
    await requireAdmin();
    return <AnalyticsAdminClient />;
}
