import { createServerSupabase } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isPrimaryOwner } from '@/lib/auth/account-type';
import { AnalyticsTab as AnalyticsClient } from './analytics-client';
import { headers } from 'next/headers';

export default async function AnalyticsPage() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    const primaryOwner = await isPrimaryOwner(user.id);
    if (!primaryOwner) {
        redirect('/owner/overview');
    }

    const host = headers().get('host');
    const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Fetch initial data
    const [eventsRes, modelsRes] = await Promise.all([
        fetch(`${baseUrl}/api/admin/events?days=7&limit=500`, { cache: 'no-store' }),
        fetch(`${baseUrl}/api/admin/models`, { cache: 'no-store' })
    ]);

    const eventsData = eventsRes.ok ? await eventsRes.json() : { events: [], analytics: [], systemStats: null };
    const modelsData = modelsRes.ok ? await modelsRes.json() : { models: [] };

    return (
        <AnalyticsClient 
            initialEvents={eventsData.events || []}
            initialAnalytics={eventsData.analytics || []}
            initialSystemStats={eventsData.systemStats || null}
            initialModels={modelsData.models || []}
        />
    );
}
