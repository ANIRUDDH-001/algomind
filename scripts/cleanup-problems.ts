import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const IDS_TO_DELETE = [
    'binary-tree-inorder-traversal',
    'binary-tree-level-order',
    'kth-smallest-bst',
    'partition-equal-subset',
    'min-depth-tree',
    'container-most-water',
    'median-sorted-arrays',
    'best-time-stock',
    'max-depth-tree',
    'invert-tree',
    'balanced-tree',
    'merge-sorted-lists',
    'reverse-list',
    'longest-substring',
    'product-except-self',
    'letter-combinations',
    'find-min-rotated',
    'search-2d-matrix-ii',
    'remove-nth-node',
    'validate-bst',
    'three-sum',
    'search-2d-matrix',
    'implement-trie',
    'longest-consecutive',
    'serialize-deserialize-tree',
    'binary-tree-max-path-sum'
];

async function cleanup() {
    console.log(`--- Deduplication Start ---`);
    console.log(`Targeting ${IDS_TO_DELETE.length} redundant problems for deletion...`);

    const { data, error } = await supabase
        .from('problems')
        .delete()
        .in('id', IDS_TO_DELETE)
        .select();

    if (error) {
        console.error('Error during deletion:', error);
        return;
    }

    console.log(`Successfully deleted ${data?.length || 0} redundant problems.`);

    // Final Audit Check
    const { count } = await supabase
        .from('problems')
        .select('*', { count: 'exact', head: true });

    console.log(`Current total problems in database: ${count}`);
    console.log(`--- Deduplication Complete ---`);
}

cleanup();
