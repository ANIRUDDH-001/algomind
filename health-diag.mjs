import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wfdgsmhuglmrxcmwcylz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmZGdzbWh1Z2xtcnhjbXdjeWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2ODA5NCwiZXhwIjoyMDg3MTQ0MDk0fQ.niZY6x889uaulJxW_gCjGBk_fEMobRkNjH_9mIMkHus';

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
