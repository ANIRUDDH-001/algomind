// Intent Classification Regex Patterns
// First-pass instant classification (0ms) before any LLM call

// ── Types ───────────────────────────────────────────────────────────

export type IntentCategory =
    | 'greeting'
    | 'clarification'
    | 'technical'
    | 'behavioral'
    | 'code_review';

export type IntentComplexity = 'simple' | 'medium' | 'complex';

export interface PatternRule {
    pattern: RegExp;
    category: IntentCategory;
    complexity: IntentComplexity;
    confidence: number;
    label: string; // human-readable name for debugging
}

// ── SIMPLE patterns (→ Groq) ────────────────────────────────────────

const SIMPLE_PATTERNS: PatternRule[] = [
    // Greetings
    {
        pattern: /^\s*(hi|hello|hey|howdy|sup|yo|hiya|greetings|good\s*(morning|afternoon|evening|day))\s*[!.?]*\s*$/i,
        category: 'greeting',
        complexity: 'simple',
        confidence: 0.98,
        label: 'greeting',
    },
    // Farewells
    {
        pattern: /^\s*(bye|goodbye|see\s*ya|later|take\s*care|thanks?\s*(bye)?|thank\s*you)\s*[!.?]*\s*$/i,
        category: 'greeting',
        complexity: 'simple',
        confidence: 0.98,
        label: 'farewell',
    },
    // Yes / No / Acknowledgments
    {
        pattern: /^\s*(yes|yeah|yep|yup|no|nope|nah|okay|ok|sure|alright|right|correct|absolutely|definitely|of\s*course)\s*[!.?]*\s*$/i,
        category: 'clarification',
        complexity: 'simple',
        confidence: 0.97,
        label: 'yes_no',
    },
    // Acknowledgments (multi-word)
    {
        pattern: /^\s*(i\s*see|got\s*it|understood|makes\s*sense|that('s|\s*is)\s*clear|i\s*understand|fair\s*enough|sounds\s*good)\s*[!.?]*\s*$/i,
        category: 'clarification',
        complexity: 'simple',
        confidence: 0.95,
        label: 'acknowledgment',
    },
    // Simple confirmations
    {
        pattern: /^\s*(that('s|\s*is)\s*(correct|right|exactly)|yes,?\s*(exactly|that('s|\s*is)\s*it)|exactly\s*(right|so)?)\s*[!.?]*\s*$/i,
        category: 'clarification',
        complexity: 'simple',
        confidence: 0.95,
        label: 'confirmation',
    },
    // Repetition / clarification requests
    {
        pattern: /^\s*(can\s*you\s*repeat|say\s*that\s*again|what\s*do\s*you\s*mean|come\s*again|pardon|sorry\s*what|i\s*didn'?t\s*(get|catch|hear)\s*that)\s*[!.?]*\s*$/i,
        category: 'clarification',
        complexity: 'simple',
        confidence: 0.93,
        label: 'repeat_request',
    },
    // Readiness
    {
        pattern: /^\s*(i('m|\s*am)\s*ready|let('s|\s*us)\s*(go|start|begin|do\s*(it|this))|ready|go\s*ahead|start)\s*[!.?]*\s*$/i,
        category: 'greeting',
        complexity: 'simple',
        confidence: 0.94,
        label: 'readiness',
    },
];

// ── MEDIUM patterns (→ Groq with fallback) ──────────────────────────

const MEDIUM_PATTERNS: PatternRule[] = [
    // Short definition questions (< ~10 words, starts with "what is")
    {
        pattern: /^\s*what\s*(is|are)\s*(a|an|the)?\s*\S+(\s+\S+){0,5}\s*\??\s*$/i,
        category: 'technical',
        complexity: 'medium',
        confidence: 0.85,
        label: 'definition',
    },
    // Basic example requests
    {
        pattern: /^\s*(give|show|provide)\s*(me\s*)?(a|an|some)?\s*example(s)?\s*(of\s+\S+(\s+\S+){0,5})?\s*[.?]*\s*$/i,
        category: 'technical',
        complexity: 'medium',
        confidence: 0.85,
        label: 'example_request',
    },
    // Simple "how does X work" (short queries ≤ 10 words)
    {
        pattern: /^\s*how\s+(does|do|did)\s+\S+(\s+\S+){0,6}\s*(work|function|operate)\s*\??\s*$/i,
        category: 'technical',
        complexity: 'medium',
        confidence: 0.82,
        label: 'how_works',
    },
    // "Can you explain X" (short)
    {
        pattern: /^\s*(can\s*you\s*)?(explain|describe|define)\s+\S+(\s+\S+){0,4}\s*\??\s*$/i,
        category: 'technical',
        complexity: 'medium',
        confidence: 0.80,
        label: 'explain_short',
    },
    // "What's the difference between X and Y" (short)
    {
        pattern: /^\s*what('s|\s*is)\s*the\s*difference\s*between\s+\S+\s+and\s+\S+\s*\??\s*$/i,
        category: 'technical',
        complexity: 'medium',
        confidence: 0.80,
        label: 'difference_short',
    },
];

// ── COMPLEX patterns (→ Gemini) ─────────────────────────────────────

const COMPLEX_PATTERNS: PatternRule[] = [
    // Algorithm / data structure explanations
    {
        pattern: /\b(explain|describe|walk\s*me\s*through|implement)\b.*\b(algorithm|sort(ing)?|search(ing)?|traversal|dynamic\s*program|graph|tree|bfs|dfs|dijkstra|binary\s*search|merge\s*sort|quick\s*sort|heap|trie|linked\s*list|stack|queue|hash\s*(table|map)|recursion)\b/i,
        category: 'technical',
        complexity: 'complex',
        confidence: 0.92,
        label: 'algorithm',
    },
    // Code review requests
    {
        pattern: /\b(review|check|look\s*at|analyze|critique|audit|evaluate|debug|fix|find\s*(bugs?|issues?|errors?))\b.*\b(my\s*)?(code|solution|implementation|function|program|script)\b/i,
        category: 'code_review',
        complexity: 'complex',
        confidence: 0.93,
        label: 'code_review',
    },
    // Multi-step design problems
    {
        pattern: /\b(how\s*would\s*you\s*(design|build|architect|implement|create|structure)|design\s*(a|an|the)|system\s*design|walk\s*me\s*through\s*(building|designing|creating))\b/i,
        category: 'technical',
        complexity: 'complex',
        confidence: 0.91,
        label: 'design',
    },
    // Trade-off / comparison discussions
    {
        pattern: /\b(compare|pros?\s*and\s*cons?|trade[\s-]*offs?|advantages?\s*(and|vs)\s*disadvantages?|when\s*would\s*you\s*(use|choose|prefer)|which\s*is\s*better)\b/i,
        category: 'technical',
        complexity: 'complex',
        confidence: 0.88,
        label: 'tradeoff',
    },
    // Behavioral questions
    {
        pattern: /\b(tell\s*me\s*about\s*a\s*time\s*when|describe\s*a\s*situation\s*where|give\s*me\s*an\s*example\s*of\s*when\s*you|how\s*(did|do)\s*you\s*handle|what\s*would\s*you\s*do\s*if)\b/i,
        category: 'behavioral',
        complexity: 'complex',
        confidence: 0.90,
        label: 'behavioral',
    },
    // Time/space complexity analysis
    {
        pattern: /\b(time\s*complexity|space\s*complexity|big[\s-]*o|runtime\s*analysis|asymptotic|amortized)\b/i,
        category: 'technical',
        complexity: 'complex',
        confidence: 0.89,
        label: 'complexity_analysis',
    },
    // Code with multi-line or substantial content
    {
        pattern: /```[\s\S]{50,}/,
        category: 'code_review',
        complexity: 'complex',
        confidence: 0.90,
        label: 'code_block',
    },
    // Optimization requests
    {
        pattern: /\b(optimize|improve|refactor|make\s*(it\s*)?(faster|more\s*efficient|better))\b.*\b(code|solution|algorithm|implementation|approach)\b/i,
        category: 'code_review',
        complexity: 'complex',
        confidence: 0.88,
        label: 'optimization',
    },
];

// ── Exports ─────────────────────────────────────────────────────────

/** All pattern rules grouped by complexity, ordered simple → medium → complex */
export const ALL_PATTERNS: PatternRule[] = [
    ...SIMPLE_PATTERNS,
    ...MEDIUM_PATTERNS,
    ...COMPLEX_PATTERNS,
];

export { SIMPLE_PATTERNS, MEDIUM_PATTERNS, COMPLEX_PATTERNS };
