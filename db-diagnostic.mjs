import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Fill these in before running:
const SUPABASE_URL = 'https://wfdgsmhuglmrxcmwcylz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmZGdzbWh1Z2xtcnhjbXdjeWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1NjgwOTQsImV4cCI6MjA4NzE0NDA5NH0.6t8s17OY8sO-c8X_txZ1U3TCdDvC0IZsbZo-nKTOsQ0';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

const out = [];
function log(...args) {
    out.push(args.join(' '));
}

async function safeRpc(name) {
    try {
        return await sb.rpc(name);
    } catch (e) {
        return { data: null };
    }   
}

async function safeFrom(table, select, eqCol, eqVal) {
    try {
        let q = sb.from(table).select(select);
        if (eqCol) q = q.eq(eqCol, eqVal);
        return await q;
    } catch (e) {
        return { data: null };
    }
}

async function run() {
    log('=== DB DIAGNOSTIC REPORT ===\n');

    // 1. All public tables
    const { data: tables } = await safeRpc('get_tables');
    const { data: tablesRaw } = await safeFrom('information_schema.tables', 'table_name', 'table_schema', 'public');

    // Use direct query via fetch instead
    const headers = {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json'
    };

    const query = async (sql) => {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ sql })
            });
            return await res.json();
        } catch (e) {
            return null;
        }
    };

    // Check tables via information_schema
    const { data: tblData, error: tblErr } = await safeFrom('information_schema.tables', 'table_name, table_type', 'table_schema', 'public');
    log('1. PUBLIC TABLES:');
    if (tblData) tblData.forEach(t => log('  -', t.table_name, `(${t.table_type})`));
    else log('  ERROR:', tblErr?.message);

    // 2. admin_users table contents
    log('\n2. ADMIN_USERS ROWS:');
    const { data: admins, error: adminErr } = await safeFrom('admin_users', '*');
    if (admins) admins.forEach(a => log('  -', a.email, '|', a.created_at));
    else log('  ERROR:', adminErr?.message, adminErr?.code);

    // 3. RLS policies on admin_users
    log('\n3. RLS POLICIES ON admin_users:');
    const { data: policies, error: polErr } = await safeFrom('pg_policies', 'policyname, cmd, qual', 'tablename', 'admin_users');
    if (policies) policies.forEach(p => log('  -', p.policyname, '|', p.cmd));
    else log('  ERROR (expected if no pg_policies view):', polErr?.message);

    // 4. Check is_admin function exists
    log('\n4. is_admin() FUNCTION EXISTS:');
    try {
        const fnDataReq = await sb.from('information_schema.routines')
            .select('routine_name, routine_type')
            .eq('routine_schema', 'public')
            .eq('routine_name', 'is_admin');
        const fnData = fnDataReq.data;
        const fnErr = fnDataReq.error;
        if (fnData?.length > 0) log('  ✅ is_admin() exists');
        else log('  ❌ is_admin() NOT FOUND. Error:', fnErr?.message);
    } catch (e) {
        log('  ❌ is_admin() NOT FOUND. Error:', e.message);
    }

    // 5. All functions in public schema
    log('\n5. ALL PUBLIC FUNCTIONS:');
    const { data: fns } = await safeFrom('information_schema.routines', 'routine_name', 'routine_schema', 'public');
    if (fns) fns.forEach(f => log('  -', f.routine_name));

    // 6. problems count
    log('\n6. TABLE ROW COUNTS:');
    const tables2 = ['problems', 'dsa_knowledge', 'interview_sessions', 'assessments', 'profiles'];
    for (const t of tables2) {
        try {
            const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
            log(`  ${t}: ${error ? 'ERROR - ' + error.message : count + ' rows'}`);
        } catch (e) {
            log(`  ${t}: ERROR - ${e.message}`);
        }
    }

    // 7. auth.users count (via service role)
    log('\n7. AUTH USERS:');
    try {
        const { data: { users }, error: authErr } = await sb.auth.admin.listUsers();
        if (users) {
            log(`  Total: ${users.length} users`);
            users.forEach(u => log('  -', u.email, '| id:', u.id));
        } else log('  ERROR:', authErr?.message);
    } catch (e) {
        log('  ERROR:', e.message);
    }

    // 8. profiles table
    log('\n8. PROFILES TABLE:');
    const { data: profiles, error: profErr } = await safeFrom('profiles', 'id, email, created_at');
    if (profiles) profiles.forEach(p => log('  -', p.email));
    else log('  ERROR:', profErr?.message);

    // 9. model_registry check
    log('\n9. MODEL_REGISTRY:');
    try {
        const { data: models, error: modErr } = await sb.from('model_registry').select('model_id, is_active').limit(5);
        if (models) models.forEach(m => log('  -', m.model_id, m.is_active ? '✅' : '❌'));
        else log('  NOT FOUND (expected if migration not run yet):', modErr?.message);
    } catch (e) {
        log('  NOT FOUND (expected if migration not run yet):', e.message);
    }

    log('\n=== END DIAGNOSTIC ===');
    fs.writeFileSync('diag-out.txt', out.join('\n'));
}

run().catch(e => {
    out.push(e.message);
    fs.writeFileSync('diag-out.txt', out.join('\n'));
});
