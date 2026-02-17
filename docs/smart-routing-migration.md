# Smart Routing Migration Guide

## Overview

Smart routing automatically classifies queries by complexity and routes them to the optimal AI model:
- **Simple queries** (greetings, yes/no, acknowledgments) → **Groq** (faster, cheaper)
- **Complex queries** (algorithms, code review, system design) → **Gemini** (deeper reasoning)

## Enabling Smart Routing

Set the feature flag via environment variable:

```env
NEXT_PUBLIC_FF_ENABLE_SMART_ROUTING=true
```

Or toggle at runtime via the admin panel's feature flags section.

> **When disabled**, `preferredModel: 'auto'` behaves identically to the old `preferredProvider: 'groq'` — zero behavior change.

## Migrating Existing Code

### Before (using `generateCompletion`)

```typescript
const client = getAIClient();
const result = await client.generateCompletion(messages, {
  preferredProvider: 'groq',
  maxTokens: 4096,
  systemPrompt: 'You are a helpful assistant.',
});
```

### After (using `generateResponse`)

```typescript
const client = getAIClient();
const result = await client.generateResponse(messages, {
  preferredModel: 'auto',  // or 'groq' / 'gemini' to force
  maxTokens: 4096,
  systemPrompt: 'You are a helpful assistant.',
});

// Access routing metadata (when smart routing is active)
if (result.routing?.smartRoutingUsed) {
  console.log(`Classified as: ${result.routing.classification.complexity}`);
  console.log(`Routed to: ${result.routing.routedTo}`);
  console.log(`Classification took: ${result.routing.classificationTimeMs}ms`);
}
```

### Key Differences

| Aspect | `generateCompletion()` | `generateResponse()` |
|--------|----------------------|---------------------|
| Status | Still works (no changes) | New recommended API |
| Routing | Manual (`preferredProvider`) | Auto or manual (`preferredModel`) |
| Telemetry | None | Records routing decisions |
| Response type | `CompletionResult` | `AIResponse` (superset) |
| Fallback | Provider-specific rules | Cross-provider automatic fallback |

## Telemetry

Routing decisions are tracked in-memory. Access via:

```typescript
import { getModelTelemetry } from '@/lib/analytics/model-telemetry';

const telemetry = getModelTelemetry();
const stats = telemetry.getStats();
console.log(`Groq calls: ${stats.routedToGroq}`);
console.log(`Gemini calls: ${stats.routedToGemini}`);
console.log(`Time saved: ${stats.estimatedSavings.estimatedTimeSavedMs}ms`);
```

## Admin Override

Force all queries to a specific model (useful for debugging):

```typescript
import { getIntentClassifier } from '@/lib/ai';

const classifier = getIntentClassifier();
classifier.setModelOverride('gemini'); // Force Gemini
classifier.setModelOverride(null);     // Restore auto-routing
```
