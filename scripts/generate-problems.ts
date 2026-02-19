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
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-3-pro-preview",
    "gemma-3-27b-it"
];

// Tracking model status
const modelStatus: Record<string, { exhausted: boolean; failed: boolean; reason?: string }> = {};
[...GROQ_MODELS, ...GEMINI_MODELS].forEach(m => {
    modelStatus[m] = { exhausted: false, failed: false };
});

async function verifyProblemsBatchWithFallback(problems: any[], startModelIndex: number = 0): Promise<{ results: any[]; lastModelIndex: number }> {
    let modelIndex = startModelIndex;

    while (modelIndex < GEMINI_MODELS.length) {
        const currentModel = GEMINI_MODELS[modelIndex];
        if (modelStatus[currentModel].exhausted || modelStatus[currentModel].failed) {
            modelIndex++;
            continue;
        }

        console.log(`🔍 Verifying ${problems.length} problems with ${currentModel}...`);

        const prompt = `You are a Senior Software Engineer and DSA expert. 
Review the following DSA problems for logical correctness, completeness, and clarity.
Standard: Must have a clear description, correct constraints, relevant examples with explanations, and helpful hints.

Problems:
${problems.map((p, i) => `--- PROBLEM ${i + 1} ---\n${JSON.stringify(p, null, 2)}`).join('\n\n')}

Return ONLY a JSON array of objects in this exact order:
[
  { "title": "...", "valid": boolean, "reason": "Explanation", "sanitized_problem": { ... } },
  ...
]`;

        try {
            const url = `${GEMINI_BASE_URL}${currentModel}:generateContent?key=${geminiApiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { response_mime_type: "application/json" }
                })
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
                console.error(`Gemini Error (${response.status}): ${err}`);
                if (err.includes("not found")) {
                    modelStatus[currentModel].failed = true;
                    modelStatus[currentModel].reason = "Model mapping error / doesn't exist";
                }
                modelIndex++;
                continue;
            }

            const data: any = await response.json();
            const text = data.candidates[0].content.parts[0].text;
            return { results: JSON.parse(text), lastModelIndex: modelIndex };
        } catch (e) {
            console.error(`Gemini verification failed with ${currentModel}:`, e instanceof Error ? e.message : e);
            modelIndex++;
        }
    }
    return { results: [], lastModelIndex: modelIndex };
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

        const prompt = `Generate ${count} unique, high-quality Data Structures and Algorithms problems.
DO NOT generate any of the following problems:
${Array.from(existingTitles).slice(0, 50).join(', ')}

Format each problem as a JSON object within a JSON array. 
Schema:
{
  "id": "kebab-case-id",
  "title": "Problem Title",
  "difficulty": "easy" | "medium" | "hard",
  "description": "DETAILED 4-6 sentence multi-paragraph description. Must explain the objective, the input structure, and the logic clearly. Include a section for Constraints (e.g., n <= 10^5).",
  "tags": ["Tag1", "Tag2"],
  "hints": ["Hint 1", "Hint 2", "Hint 3"],
  "examples": [{ "input": "...", "output": "...", "explanation": "Detailed step-by-step why this output exists." }],
  "external_url": "https://leetcode.com/problems/..."
}

CRITICAL: Return ONLY the JSON array. High detail required. No placeholders. If the description is less than 150 characters, it will be rejected.`;

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
    console.log('--- Resuming Large-Scale Orchestrated Generation (Target: 250) ---');

    const { data: existing } = await supabase.from('problems').select('title');
    const existingTitles = new Set(existing?.map(p => p.title) || []);
    console.log(`Baseline: ${existingTitles.size} existing problems.`);

    const totalToGenerate = 250;
    let totalAdded = 0;
    let currentGroqIndex = 0;
    let currentGeminiIndex = 0;
    const report: any[] = [];

    while (totalAdded < totalToGenerate) {
        // 1. Generate Batch
        const { batch, lastModelIndex: nextGroqIndex } = await generateProblemsBatchWithFallback(existingTitles, 10, currentGroqIndex);
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
            const { results: verificationResults, lastModelIndex: nextGeminiIndex } = await verifyProblemsBatchWithFallback(uniqueBatch, currentGeminiIndex);
            currentGeminiIndex = nextGeminiIndex;

            if (verificationResults.length === 0) {
                if (currentGeminiIndex >= GEMINI_MODELS.length) {
                    console.error("🛑 All Gemini models exhausted. Session stopped.");
                    break;
                }
                continue;
            }

            // 4. Ingest Verified
            for (const v of verificationResults) {
                if (v.valid) {
                    const problem = v.sanitized_problem || uniqueBatch.find((p: any) => p.title === v.title);
                    if (!problem) continue;

                    const { error } = await supabase.from('problems').upsert([problem]);
                    if (!error) {
                        console.log(`✅ Admitted & Inserted: ${v.title}`);
                        existingTitles.add(v.title);
                        totalAdded++;
                        report.push({ title: v.title, status: 'INSERTED_VERIFIED', model: GEMINI_MODELS[currentGeminiIndex] });
                    } else {
                        console.error(`❌ DB Error for ${v.title}:`, error.message);
                    }
                } else {
                    console.warn(`🚫 Rejected ${v.title}: ${v.reason}`);
                    report.push({ title: v.title, status: 'REJECTED_BY_AI', reason: v.reason, model: GEMINI_MODELS[currentGeminiIndex] });
                }
                if (totalAdded >= totalToGenerate) break;
            }
        }

        console.log(`\n--- Session Progress: ${totalAdded}/250 ---`);

        if (totalAdded < totalToGenerate) {
            console.log("Sleeping 45s for rate-limit buffer...");
            await new Promise(r => setTimeout(r, 45000));
        }
    }

    // Final Report Summary
    const finalReport = {
        timestamp: new Date().toISOString(),
        total_added: totalAdded,
        model_status: modelStatus,
        details: report
    };

    const reportPath = path.resolve(process.cwd(), 'expansion_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));

    console.log(`\n--- Generation Cycle Summary ---`);
    console.log(`Successfully added: ${totalAdded} problems.`);
    console.log(`Report written to: expansion_report.json`);

    // Explicit model status logging
    console.log('\nModel Status Report:');
    Object.entries(modelStatus).forEach(([model, status]) => {
        const state = status.failed ? "❌ FAILED/NOT_EXIST" : (status.exhausted ? "🛑 EXHAUSTED" : "✅ AVAILABLE");
        console.log(`- ${model}: ${state} ${status.reason ? `(${status.reason})` : ''}`);
    });
}

main();
