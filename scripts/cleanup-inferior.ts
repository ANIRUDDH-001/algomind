import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const IDS_TO_DELETE = [
    "implement-queue-using-stacks",
    "implement-stack-using-queues",
    "search-in-2d-matrix-iii",
    "is-graph-bipartite",
    "subtree-of-another-tree",
    "lowest-common-ancestor-of-a-binary-search-tree",
    "binary-search",
    "kth-largest-element-in-a-stream",
    "last-stone-weight",
    "k-closest-points-to-origin",
    "concatenated-words",
    "majority-element",
    "palindrome-partitioning",
    "sort-colors",
    "subarray-sum-equals-k",
    "find-duplicate",
    "island-perimeter",
    "hamming-distance",
    "meeting-rooms",
    "shift-2d-grid",
    "count-and-say",
    "koko-eating-bananas",
    "basic-calculator",
    "all-paths-source-target",
    "first-missing-positive",
    "split-array-largest-sum",
    "palindrome-number",
    "climbing-stairs",
    "lfu-cache", // Included from report analysis
    "valid-parentheses" // Often generic, removing just in case to re-gen better
];

async function cleanupInferior() {
    console.log(`--- Inferior Cleanup Start ---`);
    console.log(`Targeting ${IDS_TO_DELETE.length} problems for deletion...`);

    const { data, error } = await supabase
        .from('problems')
        .delete()
        .in('id', IDS_TO_DELETE)
        .select();

    if (error) {
        console.error('Error during deletion:', error);
        return;
    }

    console.log(`Successfully deleted ${data?.length || 0} inferior problems.`);

    // Log deleted titles for record
    data?.forEach((p: any) => console.log(`- [DELETED] ${p.title}`));

    const { count } = await supabase
        .from('problems')
        .select('*', { count: 'exact', head: true });

    console.log(`Current remaining high-quality problems: ${count}`);
    console.log(`--- Cleanup Complete ---`);
}

cleanupInferior();
