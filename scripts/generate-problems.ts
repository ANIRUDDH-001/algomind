import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import fetch from 'node-fetch';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const groqApiKey = process.env.GROQ_API_KEY!;
const geminiApiKey = process.env.GEMINI_API_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

// Models configuration - ONLY HIGH TIER (2026 Standards)
const GROQ_MODELS = [
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-120b",
    "moonshotai/kimi-k2-instruct-0905",
    "llama-3.3-70b-versatile"
];

const GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemma-3-27b-it", // Prioritized fall-back per user request
    "gemini-2.0-flash",
    "gemini-2.5-pro",
    "gemini-3-pro-preview"
];

// Tracking model status
const modelStatus: Record<string, { exhausted: boolean; failed: boolean; reason?: string }> = {};
[...GROQ_MODELS, ...GEMINI_MODELS].forEach(m => {
    modelStatus[m] = { exhausted: false, failed: false };
});

async function verifyProblemsBatchWithFallback(problems: any[]): Promise<{ results: any[]; success: boolean }> {
    let modelIndex = 0;

    while (modelIndex < GEMINI_MODELS.length) {
        const currentModel = GEMINI_MODELS[modelIndex];
        if (modelStatus[currentModel].exhausted || modelStatus[currentModel].failed) {
            modelIndex++;
            continue;
        }

        console.log(`🔍 Verifying ${problems.length} problems with ${currentModel}...`);

        const prompt = `You are a Lead Tech Interviewer and Algo Expert. 
Review the following DSA problems for absolute logical correctness, completeness, and clarity.
Standard: Must have a detailed 4-6 sentence description, correct constraints (e.g., n <= 10^5), relevant examples with step-by-step explanations, and high-quality hints.

CRITICAL: REJECT any problem that has:
- Misleading or ambiguous descriptions
- Incorrect example outputs
- Weak or missing constraints
- Generic or textbook titles (e.g. "Binary Search")

Problems:
${problems.map((p, i) => `--- PROBLEM ${i + 1} ---\n${JSON.stringify(p, null, 2)}`).join('\n\n')}

Return ONLY a JSON array of objects in this exact order:
[
  { "title": "...", "valid": boolean, "reason": "Explanation if rejected", "sanitized_problem": { ... } },
  ...
]`;

        try {
            const isGemma = currentModel.includes("gemma");
            const url = `${GEMINI_BASE_URL}${currentModel}:generateContent?key=${geminiApiKey}`;

            const body: any = {
                contents: [{ parts: [{ text: prompt }] }]
            };

            // Gemma doesn't support native JSON mode, only Flash/Pro do
            if (!isGemma) {
                body.generationConfig = { response_mime_type: "application/json" };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (response.status === 429) {
                console.warn(`🛑 Gemini Rate Limit Hit for ${currentModel}. Switching...`);
                modelStatus[currentModel].exhausted = true;
                modelStatus[currentModel].reason = "429 Rate Limit";
                modelIndex++;
                continue;
            }

            if (!response.ok) {
                const err = await response.text();
                // console.error(`Gemini Error (${response.status}): ${err}`); // Reduce noise
                if (err.includes("not found") || err.includes("not enabled")) {
                    modelStatus[currentModel].failed = true;
                    modelStatus[currentModel].reason = `API Error: ${response.status}`;
                }
                modelIndex++;
                continue;
            }

            const data: any = await response.json();
            let text = data.candidates[0].content.parts[0].text.trim();

            // Cleanup Markdown for Gemma/others if they send it
            if (text.startsWith("```")) {
                text = text.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
            }

            try {
                const results = JSON.parse(text);
                return { results, success: true };
            } catch (jsonErr) {
                console.warn(`⚠️ JSON Parse Error with ${currentModel}. Retrying with next model...`);
                // Don't exhaust model on parsing error, just skip for this batch
                modelIndex++;
                continue;
            }
        } catch (e) {
            console.error(`Verification failed with ${currentModel}:`, e instanceof Error ? e.message : e);
            modelIndex++;
        }
    }
    return { results: [], success: false };
}

async function generateProblemsBatchWithFallback(existingTitles: Set<string>, count: number = 5, startModelIndex: number = 0) {
    let modelIndex = startModelIndex;

    while (modelIndex < GROQ_MODELS.length) {
        const currentModel = GROQ_MODELS[modelIndex];
        if (modelStatus[currentModel].exhausted || modelStatus[currentModel].failed) {
            modelIndex++;
            continue;
        }

        console.log(`🚀 Attempting generation with ${currentModel}...`);

        const prompt = `Generate ${count} distinct, HIGH-QUALITY, PRODUCTION-READY DSA problems specifically from these curated lists: 
- Blind 75
- NeetCode 150
- Striver's A-Z DSA Sheet
- Grind 75

Ensure a balanced mix of Easy, Medium, and Hard difficulties.
DO NOT generate any of the following problems:
${Array.from(existingTitles).slice(0, 50).join(', ')}

STRICT QUALITY GUIDELINES (To avoid rejection):
1. TITLES: Must be specific and descriptive (e.g., "Koko Eating Bananas" NOT "Binary Search"). Avoid generic textbook names.
2. DESCRIPTION: Must be 4-6 sentences, unambiguous, and explain the scenario clearly.
3. CONSTRAINTS: MANDATORY and precise (e.g., 1 <= n <= 10^5). DO NOT OMIT.
4. EXAMPLES: Must be logically correct with clear step-by-step explanations.
5. NO HALLUCINATIONS: Ensure the problem logic is sound and solvable.
6. **MANDATORY TAGS**: You MUST include the source list name as a tag (e.g., "Blind 75", "NeetCode 150", "Striver A-Z", "Grind 75").

Format each problem as a JSON object within a JSON array. 
Schema:
{
  "id": "kebab-case-id",
  "title": "Problem Title", // Descriptive title
  "difficulty": "easy" | "medium" | "hard",
  "description": "DETAILED 4-6 sentence multi-paragraph description. Explain objective, input, and logic with a narrative. Include 'Constraints:' section at the end.",
  "tags": ["Blind 75", "Array", "Two Pointers"], // MUST include Source List Name
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "examples": [{ "input": "...", "output": "...", "explanation": "Detailed step-by-step logic." }],
  "external_url": "https://leetcode.com/problems/..."
}

CRITICAL: Return ONLY the JSON array. High detail required. No placeholders. If description < 200 chars or constraints missing, it will be rejected.`;

        try {
            const response = await fetch(GROQ_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: currentModel,
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.8,
                    response_format: { type: "json_object" }
                })
            });

            if (response.status === 429) {
                console.warn(`🛑 Groq Rate Limit Hit for ${currentModel}. Switching...`);
                modelStatus[currentModel].exhausted = true;
                modelStatus[currentModel].reason = "429 Rate Limit";
                modelIndex++;
                continue;
            }

            if (!response.ok) {
                const err = await response.text();
                console.error(`Groq Error (${response.status}): ${err}`);

                // Handle JSON validation failure (common with some models in strict mode)
                if (response.status === 400 && err.includes("json_validate_failed")) {
                    console.warn(`⚠️ JSON Mode failed for ${currentModel}. Retrying without strict JSON mode...`);
                    try {
                        const retryResponse = await fetch(GROQ_URL, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${groqApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                model: currentModel,
                                messages: [{ role: "user", content: prompt }],
                                temperature: 0.8
                                // Removed response_format
                            })
                        });

                        if (retryResponse.ok) {
                            const data: any = await retryResponse.json();
                            let content = data.choices[0].message.content;
                            // Cleanup markdown if present
                            content = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');
                            const parsed = JSON.parse(content);
                            const batch = Array.isArray(parsed) ? parsed : (parsed.problems || parsed.results || []);
                            return { batch, lastModelIndex: modelIndex };
                        }
                    } catch (retryErr) {
                        console.error("Retry failed:", retryErr);
                    }
                }

                if (err.includes("not_found") || err.includes("decommissioned") || err.includes("unknown_model")) {
                    modelStatus[currentModel].failed = true;
                    modelStatus[currentModel].reason = "Model doesn't exist or decommissioned";
                }
                modelIndex++;
                continue;
            }

            const data: any = await response.json();
            const content = data.choices[0].message.content;
            const parsed = JSON.parse(content);
            const batch = Array.isArray(parsed) ? parsed : (parsed.problems || parsed.results || []);

            return { batch, lastModelIndex: modelIndex };
        } catch (e) {
            console.error(`Generation failed with ${currentModel}:`, e instanceof Error ? e.message : e);
            modelIndex++;
        }
    }
    return { batch: [], lastModelIndex: modelIndex };
}

async function main() {
    console.log('--- Expanding Problem Bank (Target: 250 NEW Problems from Curated Lists) ---');

    const { data: existing } = await supabase.from('problems').select('title');
    const existingTitles = new Set(existing?.map(p => p.title) || []);
    console.log(`Baseline: ${existingTitles.size} existing problems. Goal: Reach ~${existingTitles.size + 250} total.`);

    const TARGET_TOTAL = 500;
    const currentTotal = existingTitles.size; // e.g. 232
    const remaining = TARGET_TOTAL - currentTotal; // e.g. 268

    console.log(`\n📊 Status:`);
    console.log(`- Current DB Count: ${currentTotal}`);
    console.log(`- Goal: ${TARGET_TOTAL} Total Problems`);
    console.log(`- Remaining to Generate: ${remaining}`);

    if (remaining <= 0) {
        console.log(`✅ Target of ${TARGET_TOTAL} problems already reached! Exiting.`);
        return;
    }

    let totalAdded = 0;
    let currentGroqIndex = 0;
    // let currentGeminiIndex = 0; // Deprecated, verification is stateless now
    const report: any[] = [];

    // Loop until we reach the target total
    while ((existingTitles.size + totalAdded) < TARGET_TOTAL) {
        const currentDbCount = existingTitles.size + totalAdded;
        const slotsLeft = TARGET_TOTAL - currentDbCount;

        console.log(`\n--- Batch Start (Progress: ${currentDbCount}/${TARGET_TOTAL} | Needed: ${slotsLeft}) ---`);

        // Rate Limit Buffer
        if (totalAdded > 0) {
            console.log("Sleeping 20s for rate-limit buffer...");
            await new Promise(r => setTimeout(r, 20000));
        }

        // 1. Generate Batch (Ask for 5 at a time to be safe)
        const batchSize = Math.min(5, slotsLeft);
        const { batch, lastModelIndex: nextGroqIndex } = await generateProblemsBatchWithFallback(existingTitles, batchSize, currentGroqIndex);
        currentGroqIndex = nextGroqIndex;

        if (batch.length === 0) {
            if (currentGroqIndex >= GROQ_MODELS.length) {
                console.error("🛑 All Groq models exhausted. Session stopped.");
                break;
            }
            continue;
        }

        // 2. Filter Unique
        const uniqueBatch = batch.filter((p: any) => !existingTitles.has(p.title));

        if (uniqueBatch.length > 0) {
            // 3. Verify Batch
            // Simplified: Verification now auto-selects the best model every time.
            const { results: verificationResults, success } = await verifyProblemsBatchWithFallback(uniqueBatch);

            if (!success || verificationResults.length === 0) {
                // If it failed and returned success=false, it means ALL models are exhausted/failed.
                // We should check if we should abort or just continue with next batch of generation.
                // If all verifiers are dead, we MUST stop.
                const allVerifiersDead = GEMINI_MODELS.every(m => modelStatus[m].exhausted || modelStatus[m].failed);
                if (allVerifiersDead) {
                    console.error("🛑 All Gemini verifiers exhausted/failed. Session stopped.");
                    break;
                }
                continue;
            }

            // 4. Ingest Verified
            // 4. Ingest Verified
            for (const item of verificationResults) {
                if (item.valid) {
                    const finalProblem = item.sanitized_problem || uniqueBatch.find((p: any) => p.title === item.title);

                    if (!finalProblem) continue;

                    // Final check for duplicates before insert (race condition safety)
                    if (existingTitles.has(finalProblem.title)) {
                        console.log(`⚠️ Skip Duplicate (Race): ${finalProblem.title}`);
                        continue;
                    }

                    const { error } = await supabase.from('problems').upsert([finalProblem]);

                    if (error) {
                        console.error(`❌ DB Insert Error: ${error.message}`);
                    } else {
                        console.log(`✅ Admitted & Inserted: ${finalProblem.title}`);
                        existingTitles.add(finalProblem.title);
                        totalAdded++;
                        report.push(finalProblem.title);
                    }
                } else {
                    console.log(`🚫 Rejected ${item.title}: ${item.reason}`);
                }
            }
        }
    }

    // Final Report Summary
    const finalReport = {
        timestamp: new Date().toISOString(),
        total_added: totalAdded,
        model_status: modelStatus,
        details: report
    };

    // Explicit model status logging
    console.log('\nModel Status Report:');
    Object.entries(modelStatus).forEach(([model, status]) => {
        const state = status.failed ? "❌ FAILED/NOT_EXIST" : (status.exhausted ? "🛑 EXHAUSTED" : "✅ AVAILABLE");
        console.log(`- ${model}: ${state} ${status.reason ? `(${status.reason})` : ''}`);
    }); console.log(`New DB Total: ${existingTitles.size}`);

    // Check if we reached target
    if (existingTitles.size >= TARGET_TOTAL) {
        console.log(`🎉 SUCCESS: Target of ${TARGET_TOTAL} problems reached!`);
    } else {
        console.log(`⚠️ Stopped early. Progress: ${existingTitles.size}/${TARGET_TOTAL}.`);
    }

    const reportPath = path.resolve(process.cwd(), 'expansion_report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        added_count: totalAdded,
        total_db_count: existingTitles.size,
        added_problems: report
    }, null, 2));
    // Explicit model status logging
    console.log('\nModel Status Report:');
    Object.entries(modelStatus).forEach(([model, status]) => {
        const state = status.failed ? "❌ FAILED/NOT_EXIST" : (status.exhausted ? "🛑 EXHAUSTED" : "✅ AVAILABLE");
        console.log(`- ${model}: ${state} ${status.reason ? `(${status.reason})` : ''}`);
    });
}

main();
