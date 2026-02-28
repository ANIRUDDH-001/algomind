import { redirect } from 'next/navigation';

export default function AnalyticsPage() {
    redirect('/owner?tab=analytics');
}
