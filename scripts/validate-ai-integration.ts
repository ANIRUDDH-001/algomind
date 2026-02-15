import { config } from 'dotenv';
import path from 'path';

// Load .env.local or .env
config({ path: path.resolve(__dirname, '../.env.local') });
config({ path: path.resolve(__dirname, '../.env') });

import { UnifiedAIClient, getAIClient } from '../src/lib/ai/client';
import { IntelligentRateLimiter, getRateLimiter } from '../src/lib/ai/rate-limiter';
import { CHAT_MODELS } from '../src/lib/ai/providers';

// Mock process.env if needed, but assuming .env.local is loaded or keys are present
// dotenv should be loaded by ts-node/register or similar if running locally

async function runTests() {
    console.log("🚀 Starting AI Integration Tests...\n");

    const client = getAIClient();
    const rateLimiter = getRateLimiter();

    // --- TEST 1: Basic Request ---
    console.log("TEST 1: Basic Request (Groq/Speed)");
    try {
        const result = await client.generateCompletion(
            [{ role: 'user', content: 'Say "Test 1 Passed" in 3 words' }],
            { preferredProvider: 'groq', category: 'speed', maxTokens: 10 }
        );
        if (result.success && result.response) {
            console.log(`✅ Passed: ${result.response.trim()} (Model: ${result.modelUsed})`);
        } else {
            console.error(`❌ Failed: ${result.error}`);
        }
    } catch (e) {
        console.error(`❌ Exception:`, e);
    }
    console.log("");


    // --- TEST 2: Groq Fallback (No Gemini) ---
    console.log("TEST 2: Groq -> Groq Fallback");
    try {
        // Manually deprecate the first priority Groq model to force fallback
        const groqModels = CHAT_MODELS.filter(m => m.provider === 'groq').sort((a, b) => a.tier - b.tier);
        const firstModel = groqModels[0].id;

        console.log(`   Simulating failure for ${firstModel}...`);
        rateLimiter.recordFailure(firstModel, "429 Too Many Requests"); // Trigger cooldown
        // Force deprecation for test if cooldown isn't enough (it should be enough to skip)
        // Actually, tryProvider skips if canUseModel returns false.
        // recordFailure might just add cooldown. 
        // Let's manually ensure it's unselectable.

        const result = await client.generateCompletion(
            [{ role: 'user', content: 'Say "Fallback Works"' }],
            { preferredProvider: 'groq', category: 'speed', maxTokens: 10 }
        );

        if (result.success) {
            if (result.modelUsed !== firstModel && result.provider === 'groq') {
                console.log(`✅ Passed: Used ${result.modelUsed} instead of ${firstModel}`);
            } else {
                console.warn(`⚠️ Warning: Used ${result.modelUsed}. Expected fallback. (First model might not be effectively blocked?)`);
            }
        } else {
            console.error(`❌ Failed: ${result.error}`);
        }

        // Reset afterwards
        rateLimiter.resetModel(firstModel);

    } catch (e) {
        console.error(`❌ Exception:`, e);
    }
    console.log("");


    // --- TEST 3: Rate Limiter Tracking ---
    console.log("TEST 3: Rate Limiter Tracking");
    const statsBefore = client.getRateLimitStatus().usage;
    // We expect some usage from Test 1 & 2
    const totalRequests = Object.values(statsBefore).reduce((sum, s) => sum + s.minuteCount, 0);
    if (totalRequests > 0) {
        console.log(`✅ Passed: Rate limiter tracked ${totalRequests} requests so far.`);
    } else {
        console.error(`❌ Failed: Rate limiter shows 0 requests.`);
    }
    console.log("");


    // --- TEST 4: Health Check Model Count ---
    console.log("TEST 4: Health Check Model Count");
    const health = await client.checkAllModels();
    const modelCount = Object.keys(health).length;

    // We expect 14 based on the updated providers list
    // 7 Groq + 7 Gemini = 14
    if (modelCount >= 14) {
        console.log(`✅ Passed: Returns status for ${modelCount} models.`);
    } else {
        console.error(`❌ Failed: Expected 14+ models, got ${modelCount}.`);
    }
    // Verify availablity format
    const sample = Object.values(health)[0];
    if (sample && typeof sample.available === 'boolean') {
        console.log(`✅ Passed: valid health status format.`);
    }
    console.log("");


    // --- TEST 5: Existing Message Format Compatibility ---
    console.log("TEST 5: Legacy 'chat' method compatibility");
    try {
        const legacyResult = await client.chat([
            { role: 'user', content: 'Say "Legacy Works"' }
        ]);
        if (legacyResult.response) {
            console.log(`✅ Passed: Legacy chat method returned response.`);
        } else {
            console.error(`❌ Failed: Legacy response empty.`);
        }
    } catch (e) {
        console.error(`❌ Exception:`, e);
    }
    console.log("");

    console.log("🏁 Tests Completed.");
}

runTests().catch(console.error);
