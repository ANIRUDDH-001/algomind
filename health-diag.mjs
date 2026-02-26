import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wfdgsmhuglmrxcmwcylz.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE';

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkHealth() {
    console.log('=== Targetted Health Diagnostic ===');

    // 1. Recent Errors in last 48h
    const d48 = new Date();
    d48.setHours(d48.getHours() - 48);

    const { data: errors, error: errFetch } = await sb
        .from('system_events')
        .select('*')
        .gte('created_at', d48.toISOString())
        .neq('type', 'cron_completed')
        .order('created_at', { ascending: false })
        .limit(20);

    if (errFetch) {
        console.error('Error fetching events:', errFetch);
    } else {
        console.log(`\n--- Recent System Events (48h) [Total: ${errors?.length || 0}] ---`);
        errors?.forEach(e => {
            console.log(`[${e.created_at}] ${e.type}: ${JSON.stringify(e.metadata)}`);
        });
    }

    // 2. Model Registry Status
    const { data: models } = await sb.from('model_registry').select('*');
    console.log('\n--- Model Registry ---');
    models?.forEach(m => {
        console.log(`${m.model_id}: Active=${m.is_active}, DeprecatedAt=${m.deprecated_at}`);
    });

    // 3. Check for specific Edge Function triggers in system_events
    const { data: edgeEvents } = await sb
        .from('system_events')
        .select('*')
        .ilike('type', '%edge%')
        .limit(10);
    console.log('\n--- Edge-related Events ---');
    console.log(JSON.stringify(edgeEvents, null, 2));
}

checkHealth();
