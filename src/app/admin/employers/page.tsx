import { requireAdmin } from '@/lib/auth/is-admin';
import EmployersClient from './client';

export const dynamic = 'force-dynamic';

export default async function EmployersPage() {
    await requireAdmin();
    return <EmployersClient />;
}
