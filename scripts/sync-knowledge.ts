// Standalone Knowledge Sync Script
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load env
const envPath = path.resolve(__dirname, '..', '.env.local');
console.log(`Loading env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn('⚠️  Warning: .env.local not found');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Ideally we want SERVICE_ROLE_KEY for admin writes, but ANON might work with correct RLS or if we are just testing
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY!);

const EMBEDDINGS_PATH = path.join(__dirname, '..', 'src', 'data', 'dsa-knowledge', 'embeddings', 'embeddings.json');

async function main() {
    console.log('🚀 Starting Knowledge Sync...');

    if (!fs.existsSync(EMBEDDINGS_PATH)) {
        console.error(`Embeddings file not found: ${EMBEDDINGS_PATH}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(EMBEDDINGS_PATH, 'utf-8');
    const chunks = JSON.parse(rawData);

    console.log(`Found ${chunks.length} chunks to sync.`);

    let successCount = 0;
    let failCount = 0;

    for (const chunk of chunks) {
        process.stdout.write('.');

        // Prepare payload matching DB schema
        const payload = {
            id: chunk.id,
            topic: chunk.topic,
            subtopic: chunk.subtopic,
            content: chunk.content,
            keywords: chunk.keywords,
            difficulty: chunk.difficulty,
            source: 'script',
            status: 'active',
            usage_count: 0,
            effectiveness_score: 0,
            embedding: chunk.embedding // Vector column
        };

        const { error } = await supabase
            .from('knowledge_chunks')
            .upsert(payload, { onConflict: 'id' });

        if (error) {
            process.stdout.write('X');
            console.error('\nSync error:', error.message);
            failCount++;
        } else {
            successCount++;
        }

        // Rate limit kindness
        await new Promise(r => setTimeout(r, 100));
    }

    console.log('\n\n✨ Sync Complete!');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

main().catch(console.error);
