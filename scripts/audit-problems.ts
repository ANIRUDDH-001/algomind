import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function audit() {
    console.log('--- Question Bank Audit ---');

    const { data: problems, error } = await supabase
        .from('problems')
        .select('id, title, description, difficulty, tags');

    if (error) {
        console.error('Error fetching problems:', error);
        return;
    }

    console.log(`Total problems: ${problems.length}`);

    // Group by title
    const groups: Record<string, any[]> = {};
    problems.forEach(p => {
        if (!groups[p.title]) groups[p.title] = [];
        groups[p.title].push(p);
    });

    const duplicates = Object.entries(groups).filter(([_, group]) => group.length > 1);

    if (duplicates.length === 0) {
        console.log('No duplicates found by title.');
        return;
    }

    console.log(`\nFound ${duplicates.length} titles with potential duplicates:`);

    duplicates.forEach(([title, group]) => {
        console.log(`\n[${title}] - ${group.length} entries:`);
        group.forEach(p => {
            const descPreview = p.description.slice(0, 50).replace(/\n/g, ' ') + '...';
            console.log(`  - ID: ${p.id} | Desc Length: ${p.description.length} | Difficulty: ${p.difficulty}`);
            console.log(`    Preview: ${descPreview}`);
        });

        // Suggest which one to keep (longest description)
        const sorted = [...group].sort((a, b) => b.description.length - a.description.length);
        console.log(`  -> RECOMMEND KEEPING ID: ${sorted[0].id}`);
        console.log(`  -> RECOMMEND DELETING: ${sorted.slice(1).map(p => p.id).join(', ')}`);
    });
}

audit();
