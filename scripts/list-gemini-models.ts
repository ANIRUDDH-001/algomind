import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const geminiApiKey = process.env.GEMINI_API_KEY!;

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.log(`Error: ${e}`);
    }
}

listModels();
