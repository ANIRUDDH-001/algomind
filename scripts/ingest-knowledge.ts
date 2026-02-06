// Standalone Knowledge Ingestion Script
// Self-contained to avoid TS module resolution issues

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
console.log(`Loading env from: ${envPath}`);

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn(`⚠️  Warning: .env.local not found at ${envPath}`);
}

const RAW_DIR = path.join(__dirname, '..', 'src', 'data', 'dsa-knowledge', 'raw');
const OUTPUT_DIR = path.join(__dirname, '..', 'src', 'data', 'dsa-knowledge', 'embeddings');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('Configured API Key:', GEMINI_API_KEY ? `${GEMINI_API_KEY.substring(0, 8)}...` : 'NOT SET');

if (!GEMINI_API_KEY || GEMINI_API_KEY.startsWith('your_')) {
    console.error('❌ GEMINI_API_KEY is not set or is still using the placeholder in .env.local');
    console.error('Please open .env.local and paste your valid API key (starting with AIza...).');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// --- Types ---
interface KnowledgeChunk {
    id: string;
    topic: string;
    subtopic: string;
    title: string;
    content: string;
    keywords: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    patterns: string[];
    timeComplexity?: string;
    spaceComplexity?: string;
}

interface EmbeddedChunk extends KnowledgeChunk {
    embedding: number[];
    embeddingModel: string;
}

// --- Helpers ---
function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'for', 'on', 'with'
    ]);
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !stopWords.has(word))
        .filter((word, index, arr) => arr.indexOf(word) === index);
}

function chunkText(text: string, title: string, topic: string): KnowledgeChunk[] {
    const chunks: KnowledgeChunk[] = [];
    const sections = text.split(/^##\s+/m).filter(s => s.trim().length > 0);

    for (const section of sections) {
        const lines = section.split('\n');
        const sectionTitle = lines[0].trim().replace(/^#+\s*/, '');
        const content = lines.slice(1).join('\n').trim();

        if (content.length < 50) continue;

        let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
        const lower = content.toLowerCase();
        if (lower.includes('hard') || lower.includes('dp')) difficulty = 'hard';
        if (lower.includes('basic') || lower.includes('easy')) difficulty = 'easy';

        const patterns = [];
        if (lower.includes('two pointer')) patterns.push('two-pointers');
        if (lower.includes('sliding window')) patterns.push('sliding-window');
        if (lower.includes('dfs')) patterns.push('dfs');
        if (lower.includes('bfs')) patterns.push('bfs');

        const id = crypto.createHash('md5').update(`${topic}-${sectionTitle}`).digest('hex');

        chunks.push({
            id,
            topic,
            subtopic: sectionTitle.toLowerCase().replace(/\s+/g, '-'),
            title: `${topic}: ${sectionTitle}`,
            content,
            keywords: extractKeywords(content),
            difficulty,
            patterns,
            timeComplexity: lower.match(/O\([^)]+\)/)?.[0],
            spaceComplexity: lower.match(/space\s+complexity[:\s]+(O\([^)]+\))/i)?.[1],
        });
    }
    return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
    try {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('Embedding error:', error);
        throw error;
    }
}

// --- Main ---
async function main() {
    console.log('🚀 Starting Knowledge Ingestion (Standalone Mode)...');

    if (!fs.existsSync(RAW_DIR)) {
        console.error(`Raw directory not found: ${RAW_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} markdown files.`);

    const embeddedChunks: EmbeddedChunk[] = [];
    let totalProcessed = 0;

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const content = fs.readFileSync(path.join(RAW_DIR, file), 'utf-8');
        const topic = file.replace('.md', '').toUpperCase(); // Use filename as topic
        const titleLine = content.split('\n')[0].replace('# ', ''); // First line as main title

        const chunks = chunkText(content, titleLine, topic);
        console.log(`=> Found ${chunks.length} chunks. Generating embeddings...`);

        for (const chunk of chunks) {
            process.stdout.write('.');
            try {
                const embedding = await getEmbedding(chunk.content);
                embeddedChunks.push({
                    ...chunk,
                    embedding,
                    embeddingModel: 'text-embedding-004'
                });
                // Rate limit pause just in case
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                process.stdout.write('X');
            }
        }
        console.log(' Done.');
        totalProcessed += chunks.length;
    }

    // Save to disk
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const outputPath = path.join(OUTPUT_DIR, 'embeddings.json');
    fs.writeFileSync(outputPath, JSON.stringify(embeddedChunks, null, 2));

    console.log('\n✨ Ingestion Complete!');
    console.log(`Total Chunks: ${embeddedChunks.length}/${totalProcessed}`);
    console.log(`Saved to ${outputPath}`);
}

main().catch(console.error);
