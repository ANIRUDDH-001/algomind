# AI & API Audit

## External APIs Found

| File | APIs/Endpoints |
|---|---|
| next.config.ts | leetcode.com, supabase.co, workers.dev |
| scripts/batch/sync-models.ts | https://api.groq.com/openai/v1/chat/completions, https://generativelanguage.googleapis.com/v1beta/models/ |
| src/lib/ai/bedrock-client.ts | Bedrock/OpenAI |
| src/lib/ai/client.ts | Bedrock/OpenAI |
| src/lib/ai/common-questions.ts | Bedrock/OpenAI |
| src/lib/ai/cost-guard.ts | Bedrock/OpenAI |
| src/lib/ai/index.ts | Bedrock/OpenAI |
| src/lib/ai/intent-classifier.ts | Bedrock/OpenAI |
| src/lib/ai/memory-generator.ts | Bedrock/OpenAI |
| src/lib/ai/model-registry.ts | Bedrock/OpenAI |
| src/lib/ai/model-routing.ts | Bedrock/OpenAI |
| src/lib/ai/narrative-generator.ts | Bedrock/OpenAI |
| src/lib/ai/patterns.ts | Bedrock/OpenAI |
| src/lib/ai/providers.ts | Bedrock/OpenAI |
| src/lib/ai/rate-limiter.ts | Bedrock/OpenAI |
| src/lib/ai/response-cache.ts | Bedrock/OpenAI |
| src/lib/ai/response-chunker.ts | Bedrock/OpenAI |
| src/lib/ai/types.ts | Bedrock/OpenAI |
| src/lib/upstash/client.ts | Upstash Redis REST API |
| src/lib/telemetry/report-error.ts | POST /api/log-error |
