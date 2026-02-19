import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple Levenshtein distance for fuzzy matching
function levenshtein(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

async function checkDuplicates() {
    console.log('--- Checking for Duplicates in Database ---');

    const { data: problems, error } = await supabase.from('problems').select('id, title, difficulty');

    if (error || !problems) {
        console.error("Failed to fetch problems:", error);
        return;
    }

    console.log(`Analyzing ${problems.length} problems...`);

    const exactMap = new Map<string, any[]>();
    const normalizedMap = new Map<string, any[]>();
    const duplicates: any[] = [];
    const fuzzyDuplicates: any[] = [];

    // 1. Exact and Normalized Checks
    for (const p of problems) {
        // Exact
        if (exactMap.has(p.title)) {
            duplicates.push({ original: exactMap.get(p.title)![0], duplicate: p, type: 'EXACT' });
        } else {
            exactMap.set(p.title, [p]);
        }

        // Normalized (lowercase, remove non-alphanumeric)
        const normalized = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedMap.has(normalized)) {
            // Check if we haven't already caught it as EXACT
            const original = normalizedMap.get(normalized)![0];
            if (original.title !== p.title) {
                duplicates.push({ original, duplicate: p, type: 'NORMALIZED' });
            }
        } else {
            normalizedMap.set(normalized, [p]);
        }
    }

    // 2. Fuzzy Checks (O(N^2) but fine for <1000 items)
    // Only compare items that aren't already marked as duplicates
    const uniqueProblems = Array.from(exactMap.values()).map(v => v[0]);

    for (let i = 0; i < uniqueProblems.length; i++) {
        for (let j = i + 1; j < uniqueProblems.length; j++) {
            const p1 = uniqueProblems[i];
            const p2 = uniqueProblems[j];

            // Optimization: Length diff check
            if (Math.abs(p1.title.length - p2.title.length) > 3) continue;

            const dist = levenshtein(p1.title.toLowerCase(), p2.title.toLowerCase());
            // Threshold: 3 edits (e.g. "Two Sum" vs "Two Sums" is 1)
            // But ensure it's not just a short word like "BFS" vs "DFS" (dist 1)
            if (dist <= 2 && p1.title.length > 5) {
                fuzzyDuplicates.push({ p1, p2, dist });
            }
        }
    }

    // Report
    if (duplicates.length > 0) {
        console.log(`\n❌ Found ${duplicates.length} EXACT/NORMALIZED duplicates:`);
        duplicates.forEach(d => {
            console.log(`- [${d.type}] "${d.duplicate.title}" (ID: ${d.duplicate.id}) is duplicate of "${d.original.title}" (ID: ${d.original.id})`);
        });

        // Auto-delete option could be added here, but for now just reporting
    } else {
        console.log('\n✅ No EXACT or NORMALIZED duplicates found.');
    }

    if (fuzzyDuplicates.length > 0) {
        console.log(`\n⚠️ Found ${fuzzyDuplicates.length} POTENTIAL FUZZY duplicates (Manual review needed):`);
        fuzzyDuplicates.forEach(d => {
            console.log(`- "${d.p1.title}" vs "${d.p2.title}" (Dist: ${d.dist})`);
        });
    } else {
        console.log('\n✅ No POTENTIAL FUZZY duplicates found.');
    }
}

checkDuplicates();
