import { redirect } from 'next/navigation';

// /admin has no dedicated content — redirect to the main admin sub-page
export default function AdminRootPage() {
    redirect('/admin/admins');
}
