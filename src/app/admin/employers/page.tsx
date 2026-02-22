import { requireAdmin } from '@/lib/auth/is-admin';
import EmployersClient from './client'; // Refresh TS server

export const dynamic = 'force-dynamic';

export default async function EmployersPage() {
    await requireAdmin();
    return <EmployersClient />;
}
