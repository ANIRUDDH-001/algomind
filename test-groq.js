async function testGroq() {
    const key = process.env.GROQ_API_KEY;
    if (!key) { console.log("❌ GROQ_API_KEY not set"); process.exit(1); }

    // Test chat completion
    console.log("Testing Groq chat...");
    const t1 = Date.now();
    const r1 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [{ role: "user", content: "say hi" }],
            max_tokens: 10
        })
    });
    const d1 = await r1.json();
    console.log(`Chat: ${r1.status} in ${Date.now() - t1}ms — ${d1.choices?.[0]?.message?.content || d1.error?.message}`);

    // Test TTS
    console.log("Testing Groq TTS...");
    const ttsModel = process.env.GROQ_TTS_MODEL || "playai-tts";
    const t2 = Date.now();
    const r2 = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: ttsModel, voice: "tara", input: "Hello AlgoMind", response_format: "wav" })
    });
    console.log(`TTS (${ttsModel}): ${r2.status} in ${Date.now() - t2}ms — Content-Type: ${r2.headers.get("content-type")}`);
    if (!r2.ok) {
        const err = await r2.text();
        console.log("TTS Error:", err.substring(0, 200));
    }
}
testGroq().catch(console.error);
