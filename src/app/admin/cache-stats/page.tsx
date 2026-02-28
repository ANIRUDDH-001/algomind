import { redirect } from 'next/navigation';

export default function CacheStatsPage() {
    redirect('/owner?tab=cache');
}
