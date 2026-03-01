import { redirect } from 'next/navigation';

// /admin/users → /owner users tab (full user management lives in owner dashboard)
export default function AdminUsersPage() {
    redirect('/owner?tab=users');
}
