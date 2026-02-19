import { requireAdmin } from '@/lib/auth/is-admin';
import CacheStatsClient from './client';

export default async function AdminCacheStatsPage() {
    await requireAdmin(); // Redirects if not admin
    return <CacheStatsClient />;
}
