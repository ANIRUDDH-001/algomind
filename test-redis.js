const { Redis } = require("@upstash/redis");
require('dotenv').config({ path: '.env.local' });

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function main() {
    console.log("\n=== Block 12: Testing Upstash Redis ===");
    const start = Date.now();
    await redis.set("algomind_test", "ping_" + Date.now(), { ex: 60 });
    console.log("Write latency:", Date.now() - start + "ms");

    const t2 = Date.now();
    const val = await redis.get("algomind_test");
    console.log("Read latency:", Date.now() - t2 + "ms", "| Value:", val);

    const keys = Array.from({ length: 50 }, (_, i) => "algomind_test");
    const t3 = Date.now();
    await Promise.all(keys.map(k => redis.get(k)));
    console.log("50 concurrent reads:", Date.now() - t3 + "ms");

    await redis.del("algomind_test");
    console.log("✅ Redis OK");
}
main().catch(e => { console.error("❌ Redis FAIL:", e.message); process.exit(1); });
