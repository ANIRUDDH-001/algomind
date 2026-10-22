/**
 * @codesage
 * @file      src/lib/ai/reasoning.ts
 * @purpose   One place to remove model reasoning from outputs and to request hidden reasoning from Groq.
 * @tech      TypeScript
 * @connects  Used by src/lib/ai/client.ts and JSON-producing generators (memory-generator)
 * @apis      Groq reasoning params (reasoning_format / include_reasoning / reasoning_effort)
 * @db        none
 * @state     none
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */

const REASONING_TAGS = ['think', 'thinking', 'reasoning'] as const;

/** Remove <think>/<thinking>/<reasoning> content: closed blocks, unclosed tails (max_tokens cut) and orphan closers. */
export function stripReasoning(raw: string): string {
    let out = raw ?? '';
    for (const tag of REASONING_TAGS) {
        out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi'), '');
        out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*$`, 'i'), '');
        out = out.replace(new RegExp(`^[\\s\\S]*?</${tag}>`, 'i'), '');
    }
    return out.replace(/\s{2,}/g, ' ').trim();
}

/** Parse the first {...} object in a model reply after removing reasoning and code fences. */
export function extractJsonObject<T = unknown>(raw: string): T {
    const text = stripReasoning(raw).replace(/```(?:json)?/gi, '').trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) {
        throw new SyntaxError(`No JSON object in model output: "${text.slice(0, 80)}"`);
    }
    return JSON.parse(text.slice(start, end + 1)) as T;
}

/**
 * Groq request params that keep reasoning out of `content` and keep it short.
 * gpt-oss does not accept reasoning_format; qwen does. They are mutually exclusive with include_reasoning.
 */
export function groqReasoningParams(modelId: string): Record<string, unknown> {
    if (modelId.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low', include_reasoning: false };
    if (modelId.startsWith('qwen/')) return { reasoning_format: 'hidden', reasoning_effort: 'none' };
    return {};
}
