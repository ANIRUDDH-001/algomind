import { requireAdmin } from '@/lib/auth/is-admin';
import FeaturesAdminClient from './client';

export default async function FeaturesAdminPage() {
    await requireAdmin(); // Redirects if not admin
    return <FeaturesAdminClient />;
}