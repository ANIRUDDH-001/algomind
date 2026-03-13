import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://axgvcivgrdzeehzifypk.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function escapeSqlString(str) {
    if (str === null || str === undefined) return 'NULL';
    if (typeof str === 'boolean') return str ? 'true' : 'false';
    if (typeof str === 'number') return str;
    if (Array.isArray(str)) {
        if (str.length === 0) return "'[]'::jsonb";
        // Convert JS arrays to JSON strings and cast as jsonb
        return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
    }
    if (typeof str === 'object') {
        return `'${JSON.stringify(str).replace(/'/g, "''")}'::jsonb`;
    }
    return `'${String(str).replace(/'/g, "''")}'`;
}

async function exportTable(tableName) {
    console.log(`Exporting ${tableName}...`);
    const allRows = [];
    let start = 0;
    const limit = 1000;
    while (true) {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .range(start, start + limit - 1);
        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            process.exit(1);
        }
        if (!data || data.length === 0) break;
        allRows.push(...data);
        start += limit;
    }
    console.log(`Found ${allRows.length} rows in ${tableName}.`);
    if (allRows.length === 0) return '';

    let sql = `-- Data for ${tableName}\n`;

    // Build insert statements
    for (const row of allRows) {
        const keys = Object.keys(row);
        const values = keys.map(k => escapeSqlString(row[k]));
        sql += `INSERT INTO public.${tableName} (${keys.join(', ')})\nVALUES (${values.join(', ')})\nON CONFLICT (id) DO NOTHING;\n\n`;
    }
    return sql;
}

async function main() {
    const problemsSql = await exportTable('problems');
    const dsaKnowledgeSql = await exportTable('dsa_knowledge');

    const seedContent = `-- Seed data dumped on ${new Date().toISOString()}\n\n${problemsSql}\n${dsaKnowledgeSql}`;

    const outPath = path.join(process.cwd(), 'sql', 'final', '04_seeds.sql');
    fs.writeFileSync(outPath, seedContent, 'utf8');
    console.log(`Data exported successfully to ${outPath}`);
}

main().catch(console.error);
