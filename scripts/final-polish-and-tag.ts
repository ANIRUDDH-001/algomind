import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const KNOWN_SHEETS = ["Blind 75", "NeetCode 150", "Striver A-Z", "Grind 75", "LeetCode 75", "Cracking the Coding Interview"];
const KNOWN_TOPICS = [
    "Array", "String", "Hash Table", "Dynamic Programming", "Math", "Sorting", "Greedy", "Depth-First Search",
    "Binary Search", "Database", "Breadth-First Search", "Tree", "Matrix", "Two Pointers", "Bit Manipulation",
    "Stack", "Design", "Heap (Priority Queue)", "Backtracking", "Graph", "Simulation", "Sliding Window",
    "Union Find", "Linked List", "Recursion", "Trie"
];

const BATCH_SIZE = 5;

// Helper to delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function analyzeAndFixBatch(problems: any[]) {
    console.log(`🔍 Analyzing batch of ${problems.length} problems for Missing Tags & Quality...`);

    const prompt = `You are a Senior DSA Content Manager.
Review these ${problems.length} coding problems. Your goal is to STANDARDIZE their metadata.

KNOWN SOURCE SHEETS: ${JSON.stringify(KNOWN_SHEETS)}
KNOWN TOPICS: ${JSON.stringify(KNOWN_TOPICS)}

For each problem:
1. Identify if it belongs to any "Known Source Sheets" (e.g. strict match or well-known association).
2. Identify 2-5 relevant "Known Topics".
3. Check if the "description" is high quality (at least 3 sentences, clear).
4. Check if "constraints" are present and valid.

Output a JSON array with optimizations for EACH problem:
[
  {
    "id": "problem-id",
    "title": "Problem Title",
    "suggested_tags": ["Blind 75", "Array", "Two Pointers"], // Merge existing tags with new ones. ENSURE at least one Sheet tag if applicable.
    "quality_issues": [], // e.g. ["Short description", "Missing constraints"], or empty if good.
    "improved_description": "..." // ONLY if quality_issues is not empty. Provide a better, fixed description.
    "improved_constraints": "..." // ONLY if missing/bad.
  }
]

Problems:
${problems.map(p => JSON.stringify({
        id: p.id,
        title: p.title,
        current_tags: p.tags,
        description_preview: p.description.substring(0, 200) + "...",
        has_constraints: p.description.toLowerCase().includes("constraint")
    })).join('\n\n')}
`;

    try {
        const response = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.status} ${await response.text()}`);
        }

        const data: any = await response.json();
        const text = data.candidates[0].content.parts[0].text;
        return JSON.parse(text);
    } catch (e) {
        console.error("Batch AI analysis failed:", e);
        return [];
    }
}

async function runPolish() {
    console.log('--- Starting Final Polish & Tag Audit ---');

    // 1. Fetch All Problems
    const { data: problems, error } = await supabase.from('problems').select('*');
    if (error || !problems) {
        console.error("Failed to fetch problems:", error);
        return;
    }

    console.log(`Loaded ${problems.length} problems. Processing...`);

    let updatedCount = 0;
    const report: any[] = [];

    // 2. Process in Batches
    for (let i = 0; i < problems.length; i += BATCH_SIZE) {
        const batch = problems.slice(i, i + BATCH_SIZE);

        // AI Analysis
        const analysisResults = await analyzeAndFixBatch(batch);

        // Apply Fixes
        for (const result of analysisResults) {
            const original = batch.find(p => p.id === result.id);
            if (!original) continue;

            const existingTags = new Set(original.tags || []);
            const newTags = new Set(result.suggested_tags || []);

            // Merge tags
            for (const t of newTags) existingTags.add(t);
            const finalTags = Array.from(existingTags);

            // Check if update is needed
            let needsUpdate = false;
            const updates: any = {};

            // 1. Tags Update
            if (finalTags.length > (original.tags?.length || 0)) {
                needsUpdate = true;
                updates.tags = finalTags;
            }

            // 2. Content Quality Update
            if (result.quality_issues && result.quality_issues.length > 0) {
                if (result.improved_description) {
                    needsUpdate = true;
                    updates.description = result.improved_description;
                }
                // Append constraints if missing and provided
                if (result.improved_constraints && !original.description.toLowerCase().includes("constraint")) {
                    needsUpdate = true;
                    updates.description = (updates.description || original.description) + "\n\nConstraints:\n" + result.improved_constraints;
                }
            }

            if (needsUpdate) {
                const { error: updateErr } = await supabase
                    .from('problems')
                    .update(updates)
                    .eq('id', original.id);

                if (updateErr) {
                    console.error(`❌ Failed to update ${original.title}:`, updateErr.message);
                } else {
                    console.log(`✅ Updated ${original.title}: ${Object.keys(updates).join(', ')}`);
                    updatedCount++;
                    report.push({
                        title: original.title,
                        changes: Object.keys(updates),
                        added_tags: result.suggested_tags.filter((t: string) => !(original.tags || []).includes(t)),
                        issues_fixed: result.quality_issues
                    });
                }
            } else {
                console.log(`👌 No changes needed for ${original.title}`);
            }
        }

        // Rate Limit Buffer
        await sleep(2000);
    }

    // Report
    const reportPath = path.resolve(process.cwd(), 'polish_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n--- Polish Complete ---`);
    console.log(`Updated ${updatedCount} problems.`);
    console.log(`Details in polish_report.json`);
}

runPolish();
