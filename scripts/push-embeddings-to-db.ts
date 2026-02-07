// scripts/push-embeddings-to-db.ts
// Use this script to populate the 'knowledge_chunks' table from your local 'embeddings.json'

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 1. Load Environment Variables
const envPath = path.resolve(__dirname, '..', '.env.local');
console.log(`Loading env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn(`⚠️  Warning: .env.local not found at ${envPath}`);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Key for Admin Write Access

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Supabase credentials missing.');
    console.error('Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are in .env.local');
    process.exit(1);
}

// 2. Initialize Supabase Admin Client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const EMBEDDINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'dsa-knowledge', 'embeddings', 'embeddings.json');

async function main() {
    console.log('🚀 Starting DB Sync...');

    if (!fs.existsSync(EMBEDDINGS_PATH)) {
        console.error(`❌ No embeddings found at ${EMBEDDINGS_PATH}`);
        console.error('Run "npm run ingest" first to generate them.');
        process.exit(1);
    }

    // 3. Read Local Embeddings
    const rawData = fs.readFileSync(EMBEDDINGS_PATH, 'utf-8');
    const chunks = JSON.parse(rawData);
    console.log(`📂 Loaded ${chunks.length} chunks from disk.`);

    let successCount = 0;
    let errorCount = 0;

    // 4. Batch Insert/Upsert
    // We do this individually or in small batches to handle potential size limits or errors gracefully
    for (const chunk of chunks) {
        try {
            const { error } = await supabase
                .from('knowledge_chunks')
                .upsert({
                    // If your JSON has 'id', use it. Otherwise, let DB generate or use composite key?
                    // The ingest script generates a deterministic MD5 'id', so we can use that for upsert.
                    id: chunk.id,
                    topic: chunk.topic,
                    subtopic: chunk.subtopic,
                    content: chunk.content,
                    keywords: chunk.keywords,
                    difficulty: chunk.difficulty,
                    embedding: chunk.embedding, // Vector column
                    source: 'auto-ingest',
                    status: 'active'
                    // updated_at: new Date().toISOString() // Removed to avoid schema mismatch errors if column missing
                }, { onConflict: 'id' });

            if (error) {
                console.error(`❌ Failed to insert ${chunk.title}:`, error.message);
                errorCount++;
            } else {
                process.stdout.write('.');
                successCount++;
            }
        } catch (err: any) {
            console.error(`❌ Exception for ${chunk.title}:`, err.message);
            errorCount++;
        }
    }

    console.log('\n\n✅ Sync Complete!');
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
