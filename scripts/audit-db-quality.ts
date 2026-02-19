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

const BATCH_SIZE = 5; // Verifying 5 problems at once for efficiency

interface Problem {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    examples: unknown[];
    hints: string[] | null;
}

interface ValidationResult {
    id: string;
    valid: boolean;
    reason?: string;
}

async function verifyProblemsBatch(problems: Problem[]): Promise<ValidationResult[]> {
    console.log(`🔍 Verifying batch of ${problems.length} problems with Gemini...`);

    const prompt = `You are a Senior Software Engineer and DSA expert.
Review the following ${problems.length} DSA problems for logical correctness, detail, and quality.

For each problem, judge if it meets these "HIGH QUALITY" standards:
1. Multi-paragraph description explaining the logic clearly.
2. Correct and detailed constraints.
3. Multiple examples if necessary, with explanations.
4. Clean formatting.

Mark as "invalid" if it is too short (like a placeholder), has a vague description, or lacks examples.

Problems:
${problems.map((p, i) => `--- PROBLEM ${i + 1} ---\n${JSON.stringify({
        id: p.id,
        title: p.title,
        description: p.description,
        difficulty: p.difficulty,
        examples: p.examples,
        hints: p.hints
    }, null, 2)}`).join('\n\n')}

Return ONLY a JSON array of objects in this exact order:
[
  { "id": "original-id", "valid": boolean, "reason": "Explanation" },
  ...
]`;

    try {
        const response = await fetch(`${GEMINI_URL}?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });

        if (response.status === 429) {
            console.error("🛑 Gemini Rate Limit Hit (429). Stopping audit. Please resume later.");
            process.exit(1);
        }

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${err}`);
        }

        const data = await response.json() as { candidates: { content: { parts: { text: string }[] } }[] };
        const text = data.candidates[0].content.parts[0].text;
        return JSON.parse(text);
    } catch (e) {
        console.error("Batch verification failed:", e);
        throw e; // Don't assume, stop execution
    }
}

async function runFullAudit() {
    console.log('--- Starting Batch-Optimized Database Quality Audit ---');

    // Fetch all problems
    const { data: problems, error } = await supabase.from('problems').select('*');

    if (error || !problems) {
        console.error("Failed to fetch problems from Supabase:", error);
        return;
    }

    console.log(`Found ${problems.length} total problems in database.`);

    let deletedCount = 0;
    let verifiedCount = 0;
    interface ReportItem {
        title: string;
        status: 'VERIFIED' | 'DELETED';
        reason?: string;
    }

    const report: ReportItem[] = [];

    // Process in batches
    for (let i = 0; i < problems.length; i += BATCH_SIZE) {
        const currentBatch = problems.slice(i, i + BATCH_SIZE);
        try {
            const results = await verifyProblemsBatch(currentBatch);

            for (const result of results) {
                const problem = currentBatch.find(p => p.id === result.id);
                if (!problem) continue;

                if (!result.valid) {
                    console.log(`🗑️ Deleting: "${problem.title}" | Reason: ${result.reason}`);
                    const { error: delErr } = await supabase.from('problems').delete().eq('id', problem.id);
                    if (!delErr) {
                        deletedCount++;
                        report.push({ title: problem.title, status: 'DELETED', reason: result.reason });
                    }
                } else {
                    console.log(`✨ Verified: "${problem.title}"`);
                    verifiedCount++;
                    report.push({ title: problem.title, status: 'VERIFIED' });
                }
            }
        } catch (err) {
            console.error(`Audit interrupted at index ${i} due to API error.`);
            break;
        }

        // Respectful delay between batches
        await new Promise(r => setTimeout(r, 2000));
    }

    // Write final proof report
    const reportPath = path.resolve(process.cwd(), 'audit_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        total_processed: verifiedCount + deletedCount,
        verified: verifiedCount,
        deleted: deletedCount,
        details: report
    }, null, 2));

    console.log('\n--- Audit Cycle Complete ---');
    console.log(`Verified: ${verifiedCount}`);
    console.log(`Deleted: ${deletedCount}`);
    console.log(`Detailed proof written to: audit_report.json`);
}

runFullAudit();
