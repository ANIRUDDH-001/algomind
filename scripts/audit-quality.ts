import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Generic algorithm names that are usually too simple for interview problems
const GENERIC_TITLES = new Set([
    "Binary Search", "Linear Search", "Bubble Sort", "Quick Sort", "Merge Sort", "Insertion Sort",
    "Selection Sort", "Heap Sort", "Depth First Search", "Breadth First Search", "Linked List",
    "Stack", "Queue", "Binary Tree", "Trie", "Graph", "Find Max", "Find Min"
]);

async function auditQuality() {
    console.log("--- Starting Quality Audit ---");

    const { data: problems, error } = await supabase
        .from('problems')
        .select('*');

    if (error) {
        console.error("Error fetching problems:", error);
        return;
    }

    const flagged: any[] = [];

    problems.forEach((p: any) => {
        const issues: string[] = [];

        // 1. Description Length
        if (p.description.length < 200) {
            issues.push(`Short Description (${p.description.length} chars)`);
        }

        // 2. Missing Constraints
        // Check for "Constraints" header or typical constraint notation (n <=, 1 <=)
        const hasConstraints = /Constraints|1 <=|n <=|length of/i.test(p.description);
        if (!hasConstraints) {
            issues.push("Missing Constraints");
        }

        // 3. Generic Title
        if (GENERIC_TITLES.has(p.title) || /^(Implement|Basic) [A-Za-z ]+$/.test(p.title)) {
            issues.push("Generic/Textbook Title");
        }

        // 4. Low Examples
        if (!p.examples || p.examples.length < 2) {
            issues.push("Few Examples (< 2)");
        }

        // 5. No Hints
        // Some good problems might not have hints, but combined with other flags it's a signal.
        if (!p.hints || p.hints.length === 0) {
            issues.push("No Hints");
        }

        if (issues.length > 0) {
            flagged.push({
                id: p.id,
                title: p.title,
                issues: issues,
                description_snippet: p.description.substring(0, 50) + "..."
            });
        }
    });

    console.log(`Found ${flagged.length} potential inferior problems.`);

    const reportPath = path.resolve(process.cwd(), 'inferior_problems_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(flagged, null, 2));
    console.log(`Report written to: ${reportPath}`);
}

auditQuality();
