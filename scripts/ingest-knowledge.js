const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Use __dirname to be path-agnostic
const ROOT_DIR = path.resolve(__dirname, '..');
const envPath = path.resolve(ROOT_DIR, '.env.local');
dotenv.config({ path: envPath });

const RAW_DIR = path.resolve(ROOT_DIR, 'src/data/dsa-knowledge/raw');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'src/data/dsa-knowledge/embeddings');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

console.log('Root Dir:', ROOT_DIR);
console.log('Env Path:', envPath);
console.log('Gemini Key present:', !!GEMINI_API_KEY);

if (!GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY is not set in .env.local');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

// --- Helpers ---
function extractKeywords(text) {
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

function chunkText(text, title, topic) {
    const chunks = [];
    const sections = text.split(/^##\s+/m).filter(s => s.trim().length > 0);

    for (const section of sections) {
        const lines = section.split('\n');
        const sectionTitle = lines[0].trim().replace(/^#+\s*/, '');
        const content = lines.slice(1).join('\n').trim();

        if (content.length < 50) continue;

        let difficulty = 'medium';
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

async function getEmbedding(text) {
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
    console.log('🚀 Starting Knowledge Ingestion (JS Mode)...');

    if (!fs.existsSync(RAW_DIR)) {
        console.error(`Raw directory not found: ${RAW_DIR}`);
        process.exit(1);
    }

    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.md'));
    console.log(`Found ${files.length} markdown files.`);

    const embeddedChunks = [];
    let totalProcessed = 0;

    for (const file of files) {
        console.log(`Processing ${file}...`);
        const content = fs.readFileSync(path.join(RAW_DIR, file), 'utf-8');
        const topic = file.replace('.md', '').toUpperCase();
        const titleLine = content.split('\n')[0].replace('# ', '');

        const chunks = chunkText(content, titleLine, topic);
        console.log(`=> Found ${chunks.length} chunks. Generating embeddings...`);

        if (chunks.length === 0) {
            console.log("WARNING: 0 chunks found for file " + file);
        }

        for (const chunk of chunks) {
            console.log(`   Embedding chunk: ${chunk.subtopic}`);
            try {
                const embedding = await getEmbedding(chunk.content);
                if (embedding && embedding.length > 0) {
                    embeddedChunks.push({
                        ...chunk,
                        embedding,
                        embeddingModel: 'text-embedding-004'
                    });
                    console.log(`   SUCCESS: ${chunk.subtopic}`);
                } else {
                    console.error(`   ERROR: Empty embedding for ${chunk.subtopic}`);
                }
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`   FAILED: ${chunk.subtopic} - ${e.message}`);
            }
        }
        console.log(' Done with file.');
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
