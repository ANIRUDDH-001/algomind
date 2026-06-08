# Load Test Metrics

## Test Setup & Strategy
The load testing framework relies on simulated user traffic using `k6` to evaluate the actual system strength of the backend architecture, specifically hitting the Next.js App Router and the Inngest/Gemini inference pipelines.

**Authentication Constraint:**
Valid session cookies are strictly required to access real data (like `/dashboard` and `/api/chat`). The test suite injects real Supabase JWTs (`sb-...-auth-token`) directly into the `Cookie` headers to successfully bypass the Vercel Edge Middleware and reach the core backend.

## Load Test Scripts

### k6 Configuration
A precise k6 test script simulating user navigation and heavy AI chat interactions.
- **Ramp-up:** Up to 5 concurrent virtual users over 10 seconds.
- **Hold:** Hold at 5 concurrent users for 20 seconds.
- **Ramp-down:** Drop to 0 users over 5 seconds.
- **Payload:** Each user hits the `/dashboard` route, sleeps for 1 second, and then sends a direct inference request to `/api/chat` asking `What is a binary search tree?`.

## Results (Live Environment)

The script was executed against the live production server (`https://algomind-drab.vercel.app`) using valid authentication cookies.

**Quantitative Results & Logs:**
- **Checks Succeeded:** 100% (21 out of 21 requests returned HTTP 200 OK)
- **Checks Failed:** 0% (Authentication was successful)
- **Total Iterations:** 10 complete flows
- **Average Latency (`http_req_duration`):** 6.68s
- **Median Latency:** 1.70s
- **p95 Latency:** 28.09s
- **Max Latency:** 28.92s

**Analysis & Bottlenecks:**
Unlike previous test attempts that failed at the Edge Middleware, this test successfully pierced the Edge and forced the backend to do real work. 

1. **Authentication Success:** The 0% error rate proves that the Supabase SSR setup correctly verified the JWTs under load.
2. **Inference Bottleneck:** The p95 latency spiked to 28.09 seconds. This confirms that while the Next.js API router handled the concurrency without dropping connections, the actual latency bottleneck lies in the **Gemini AI Inference** processing the prompt and streaming the response. Hitting the `/api/chat` route with 5 concurrent users causes substantial generation delays.
3. **Actionable Takeaways:** To improve the p95 latency under heavy load, the platform may need to scale its Inngest concurrency limits, route to faster models (like `gemini-1.5-flash` instead of `pro` during high traffic), or implement semantic caching to prevent redundant LLM generations for common questions like "What is a binary search tree?".
