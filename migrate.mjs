import { createClient } from '@supabase/supabase-js';

const OLD_URL = 'https://axgvcivgrdzeehzifypk.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4Z3ZjaXZncmR6ZWVoemlmeXBrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDA0NDI5MiwiZXhwIjoyMDg1NjIwMjkyfQ.BUOTcPBpMDJqjGcTnuEl8-TABltFzDbC7a6-EwT1V5A'; // The original service role key from .env.local

const NEW_URL = 'https://wfdgsmhuglmrxcmwcylz.supabase.co';

// ==========================================
// 🚨 CRITICAL FIX REQUIRED HERE 🚨
// ==========================================
// The key provided previously was an ANONYMOUS key (role: anon), NOT the service_role key.
// Because it was an anon key, Supabase blocked the insert with: "new row violates row-level security policy"
//
// 1. Go to your NEW Supabase Dashboard (wfdgsmhuglmrxcmwcylz)
// 2. Click "Settings" (gear icon) -> "API"
// 3. Scroll down to "Project API keys" and copy the "service_role" secret key.
// 4. Paste it below:
const USER_PROVIDED_NEW_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmZGdzbWh1Z2xtcnhjbXdjeWx6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU2ODA5NCwiZXhwIjoyMDg3MTQ0MDk0fQ.niZY6x889uaulJxW_gCjGBk_fEMobRkNjH_9mIMkHus';

const oldSupabase = createClient(OLD_URL, OLD_KEY);
const newSupabase = createClient(NEW_URL, USER_PROVIDED_NEW_KEY);

async function migrateTable(tableName, batchSize = 100) {
    console.log(`Starting migration for table: ${tableName}`);
    let totalExported = 0;
    let totalInserted = 0;
    let start = 0;
    let errors = [];

    while (true) {
        // Fetch from old DB
        const { data, error: fetchError } = await oldSupabase
            .from(tableName)
            .select('*')
            .range(start, start + batchSize - 1);

        if (fetchError) {
            console.error(`Error fetching batch from ${tableName} (offset ${start}):`, fetchError);
            errors.push(fetchError);
            break;
        }

        if (!data || data.length === 0) {
            break;
        }

        console.log(`Exported ${data.length} rows from ${tableName} (Total: ${totalExported + data.length})`);

        // Insert into new DB
        const { error: insertError } = await newSupabase
            .from(tableName)
            .upsert(data, { onConflict: 'id' });

        if (insertError) {
            console.error(`Error inserting batch into ${tableName}:`, insertError);
            errors.push(insertError);
            break;
        }

        totalExported += data.length;
        totalInserted += data.length;
        start += batchSize;

        // Rate limiting / safety pause
        await new Promise(r => setTimeout(r, 100));
    }

    return { totalExported, totalInserted, errors };
}

async function verifyMigration(tableName, expectedCount) {
    const { count, error } = await newSupabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

    if (error) {
        console.error(`Error verifying count for ${tableName}:`, error);
        return false;
    }

    console.log(`Verification: new DB has ${count} rows in ${tableName} (Expected: ${expectedCount})`);
    return count === expectedCount;
}

async function main() {
    console.log('--- Migrating `problems` table ---');
    const problemsResult = await migrateTable('problems');
    console.log('Problems Result:', problemsResult);

    console.log('\n--- Migrating `dsa_knowledge` table ---');
    const dsaResult = await migrateTable('dsa_knowledge', 100);
    console.log('DSA Knowledge Result:', dsaResult);

    console.log('\n--- Verifying Counts ---');
    await verifyMigration('problems', problemsResult.totalExported);
    await verifyMigration('dsa_knowledge', dsaResult.totalExported);
}

main().catch(console.error);
