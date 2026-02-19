
import { config } from 'dotenv';
config({ path: '.env.local' });
import { getAIClient } from '../src/lib/ai/client';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// Specific domains for high-quality, relevant vocabulary
const DOMAINS = {
    "HR & Behavioral Interview": [
        "Strengths & Weaknesses", "Conflict Resolution", "Leadership Principles",
        "Project Management", "Workplace Culture", "Career Goals", "Salary Negotiation",
        "Team Collaboration", "Remote Work Etiquette"
    ],
    "Technical Interview Process": [
        "Whiteboard Coding", "System Design Rounds", "Pair Programming", "Code Review Feedback",
        "Clarifying Requirements", "Thinking Aloud", "Edge Case Analysis", "Algorithm Optimization"
    ],
    "Indian English & Corporate Culture": [
        "Common Hinglish Fillers (e.g. 'na', 'yaar', 'accha')",
        "Indian Corporate Idioms (e.g. 'do the needful', 'revert back')",
        "Respectful Address (Sir/Ma'am usage)",
        "Pronunciation Nuances ('v' vs 'w', 's' vs 'sh')",
        "Academic & Background Terms (Batch, Stream, Backlog)"
    ],
    "Core Data Structures": [
        "Graph Theory", "Tree Traversal", "Heap Operations", "Hashing Techniques", "Linked List Variants"
    ],
    "Advanced Algorithms": [
        "Dynamic Programming Patterns", "Greedy Strategies", "Backtracking Pruning", "Bitwise Hacks", "String Matching"
    ],
    "System Design & Architecture": [
        "Distributed Consensus", "Database Scaling", "Cache Consistency", "Microservices Patterns", "API Contracts"
    ]
};

async function generateMassiveVocabulary() {
    const client = getAIClient();
    const allTerms: Set<string> = new Set();
    const outputPath = join(process.cwd(), 'src', 'lib', 'voice', 'vocabulary-ai.ts');

    // 1. Load existing terms to avoid duplicates and provide context
    if (existsSync(outputPath)) {
        try {
            const content = await readFile(outputPath, 'utf-8');
            const match = content.match(/DSA_VOCABULARY = (\[[\s\S]*?\]);/);
            if (match && match[1]) {
                const existing = JSON.parse(match[1]);
                existing.forEach((t: string) => allTerms.add(t.toLowerCase().trim()));
                console.log(`Loaded ${allTerms.size} existing terms.`);
            }
        } catch (e) {
            console.warn("Could not load existing vocabulary, starting fresh.");
        }
    }

    console.log("🚀 Starting Targeted Vocabulary Enrichment...");

    const tasks: (() => Promise<string[]>)[] = [];

    // Prioritize HR and Indian Context as requested
    for (const [category, subtopics] of Object.entries(DOMAINS)) {
        for (const topic of subtopics) {
            // 1 deep iteration per topic, but with high count request
            tasks.push(() => generateTermsForTopic(client, category, topic, Array.from(allTerms).slice(0, 50)));
        }
    }

    // Process in chunks
    const CHUNK_SIZE = 3;
    for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
        const chunk = tasks.slice(i, i + CHUNK_SIZE);
        console.log(`Processing batch ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(tasks.length / CHUNK_SIZE)}...`);

        const results = await Promise.all(chunk.map(task => task()));

        let newCount = 0;
        results.forEach(terms => {
            if (terms && Array.isArray(terms)) {
                terms.forEach(t => {
                    const cleanT = t.toLowerCase().trim();
                    if (!allTerms.has(cleanT)) {
                        allTerms.add(cleanT);
                        newCount++;
                    }
                });
            }
        });

        console.log(`  -> Added ${newCount} new terms. Total: ${allTerms.size}`);

        // Dynamic delay
        await new Promise(r => setTimeout(r, 3000));
    }

    const sortedTerms = Array.from(allTerms).sort();

    console.log(`\n✅ Enrichment Complete! Total Unique Terms: ${sortedTerms.length}`);

    // Create file
    const fileContent = `// Auto-generated MASSIVE vocabulary list by AI
export const DSA_VOCABULARY = ${JSON.stringify(sortedTerms, null, 4)};    
`;

    await writeFile(outputPath, fileContent);
    console.log(`Written to ${outputPath}`);
}

async function generateTermsForTopic(client: any, category: string, topic: string, existingSample: string[]): Promise<string[]> {
    let prompt = "";

    const contextStr = existingSample.length > 0 ? `Avoid these existing words: ${existingSample.slice(0, 20).join(", ")}...` : "";

    if (category === "Indian English & Corporate Culture") {
        prompt = `
        List 300-500 specific words, phrases, idioms, or pronunciations commonly heard in Indian Tech Interviews or Corporate Culture.
        Topic: "${topic}"
        Include:
        - Hinglish fillers and connectors (e.g. "actually", "basically", "na", "yaar").
        - Indian English quirks (e.g. "prepone", "revert back", "passout").
        - Phonetic spellings of common Indian accent variations for tech terms (e.g. "wirtual" for virtual, "jeero" for zero).
        - Respectful terms (Sir, Ma'am).
        ${contextStr}
        Return ONLY a raw JSON array of strings.
        `;
    } else if (category === "HR & Behavioral Interview") {
        prompt = `
        List 300-500 words and phrases specific to Behavioral/HR Interviews in the Tech Industry.
        Topic: "${topic}"
        Include:
        - "STAR method" terminology (Situation, Task, Action, Result).
        - Soft skills buzzwords (Collaboration, Ownership, Bias for Action).
        - Phrases used when thinking/pausing (e.g. "Let me think", "That's a good question").
        ${contextStr}
        Return ONLY a raw JSON array of strings.
        `;
    } else {
        prompt = `
        List 500+ highly relevant technical terms, jargon, and spoken phrases for a Software Engineer Interview.
        Category: "${category} - ${topic}"
        Focus on how people *speak* in interviews (e.g. "Big O of N", "hash it", "brute force it").
        Include synonyms and variations.
        ${contextStr}
        Return ONLY a raw JSON array of strings.
        `;
    }

    // Attempt with Fallback Strategy
    const providers = [
        { id: 'gemini-1.5-flash', provider: 'gemini' },
        { id: 'gemini-2.0-flash', provider: 'gemini' },
        { id: 'llama-3.3-70b-versatile', provider: 'groq' },
        { id: 'gemma2-9b-it', provider: 'groq' }
    ];

    for (const p of providers) {
        try {
            const result = await client.generateCompletion([
                { role: 'user', content: prompt }
            ], {
                preferredProvider: p.provider,
                maxTokens: 8192,
                temperature: 0.8
            });

            if (result.success && result.response) {
                const terms = parseResponse(result.response);
                if (terms.length > 50) return terms; // Only Accept good results
            }
        } catch (e) {
            // continue
        }
    }

    return [];
}

function parseResponse(response: string): string[] {
    try {
        let clean = response.trim();
        clean = clean.replace(/```json/g, '').replace(/```/g, '');
        const start = clean.indexOf('[');
        const end = clean.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
            clean = clean.substring(start, end + 1);
            const res = JSON.parse(clean);
            return Array.isArray(res) ? res : [];
        }
    } catch (e) {
    }
    return [];
}

generateMassiveVocabulary();
