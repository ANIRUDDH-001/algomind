import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const geminiApiKey = process.env.GEMINI_API_KEY!;
const groqApiKey = process.env.GROQ_API_KEY!;

async function testGemini(model: string) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }] })
        });
        console.log(`Gemini ${model}: ${res.status} ${res.statusText}`);
        if (!res.ok) console.log(await res.text());
    } catch (e) {
        console.log(`Gemini ${model} Error: ${e}`);
    }
}

async function testGroq(model: string) {
    const url = "https://api.groq.com/openai/v1/chat/completions";
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "user", content: "hi" }],
                max_tokens: 5
            })
        });
        console.log(`Groq ${model}: ${res.status} ${res.statusText}`);
        if (!res.ok) console.log(await res.text());
    } catch (e) {
        console.log(`Groq ${model} Error: ${e}`);
    }
}

async function main() {
    console.log("--- Testing Models ---");
    await testGemini("gemini-1.5-flash");
    await testGemini("gemini-1.5-pro");
    await testGemini("gemini-2.0-flash");
    await testGemini("gemini-2.0-flash-exp");

    await testGroq("llama-3.3-70b-versatile");
    await testGroq("llama-3.1-70b-versatile");
    await testGroq("llama-3.1-8b-instant");
    await testGroq("gemma2-9b-it");
    await testGroq("deepseek-r1-distill-llama-70b");
    await testGroq("distil-whisper-large-v3-en");
}

main();
