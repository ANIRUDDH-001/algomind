/**
 * Text preprocessing for TTS to fix pronunciation of technical terms
 * Converts DSA/coding notation to spoken equivalents
 */

// Map of patterns to spoken replacements
const TTS_REPLACEMENTS: [RegExp, string][] = [
    // Pre-formatting (Markdown, Code, URLs, Math)
    [/```[\s\S]*?```/gi, 'code block'],
    [/`[^`]+`/gi, 'code block'],
    [/\*\*((?:\n|.)*?)\*\*/g, '$1'],
    [/\*((?:\n|.)*?)\*/g, '$1'],
    [/__(.*?)__/g, '$1'],
    [/_(.*?)_/g, '$1'],
    [/https?:\/\/[^\s]+/gi, 'link'],
    [/(^|\n)(\d+)\.\s/g, '$1 $2 '],
    [/\$([^$]+)\$/g, '$1'],
    [/\\\((.*?)\\\)/g, '$1'],
    [/\\\[(.*?)\\\]/g, '$1'],

    // Big O Notation - must come before simpler patterns
    [/O\(n\s*\*\s*m\)/gi, 'O of N times M'],
    [/O\(n\s*\+\s*m\)/gi, 'O of N plus M'],
    [/O\(n\^3\)/gi, 'O of N cubed'],
    [/O\(n\^2\)/gi, 'O of N squared'],
    [/O\(2\^n\)/gi, 'O of 2 to the N'],
    [/O\(n!\)/gi, 'O of N factorial'],
    [/O\(n\s*log\s*n\)/gi, 'O of N log N'],
    [/O\(log\s*n\)/gi, 'O of log N'],
    [/O\(sqrt\s*n\)/gi, 'O of square root N'],
    [/O\(n\)/gi, 'O of N'],
    [/O\(m\)/gi, 'O of M'],
    [/O\(k\)/gi, 'O of K'],
    [/O\(1\)/gi, 'O of 1, constant time'],
    [/O\(V\s*\+\s*E\)/gi, 'O of V plus E'],
    [/O\(E\s*log\s*V\)/gi, 'O of E log V'],

    // Common DSA terms
    [/\bDFS\b/g, 'depth first search'],
    [/\bBFS\b/g, 'breadth first search'],
    [/\bDP\b/g, 'dynamic programming'],
    [/\bBST\b/g, 'binary search tree'],
    [/\bDSA\b/g, 'data structures and algorithms'],
    [/\bLRU\b/g, 'L R U'],
    [/\bLFU\b/g, 'L F U'],
    [/\bAPI\b/g, 'A P I'],
    [/\bSQL\b/g, 'S Q L'],
    [/\bJSON\b/g, 'jason'],
    [/\bHTTP\b/g, 'H T T P'],
    [/\bURL\b/g, 'U R L'],
    [/\bREST\b/g, 'rest'],
    [/\bGPU\b/g, 'G P U'],
    [/\bCPU\b/g, 'C P U'],
    [/\bRAM\b/g, 'ram'],
    [/\bSSD\b/g, 'S S D'],
    [/\bHDD\b/g, 'H D D'],

    // Array/list notation
    [/arr\[i\]/gi, 'array at index i'],
    [/arr\[j\]/gi, 'array at index j'],
    [/nums\[i\]/gi, 'nums at index i'],
    [/\[i\]/g, 'at index i'],
    [/\[j\]/g, 'at index j'],
    [/\[k\]/g, 'at index k'],

    // Common operators
    [/!=/g, 'not equal to'],
    [/==/g, 'equals'],
    [/>=/g, 'greater than or equal to'],
    [/<=/g, 'less than or equal to'],
    [/&&/g, 'and'],
    [/\|\|/g, 'or'],
    [/->/g, 'arrow'],
    [/=>/g, 'arrow'],

    // Common variable patterns
    [/\bi\+\+/g, 'i plus plus'],
    [/\bi--/g, 'i minus minus'],
    [/\bj\+\+/g, 'j plus plus'],
    [/\bj--/g, 'j minus minus'],

    // Symbols that TTS struggles with
    [/\*/g, ' times '],
    [/\//g, ' divided by '],
    // % after a number in code context → modulo; otherwise → percent
    [/(\d)\s*%(?!\s*\w)/g, '$1 modulo '],   // "n%2" → "n modulo 2" (code)
    [/(\d)\s*%(?=\s*\w|\s*$)/g, '$1 percent '], // "40% efficiency" → "40 percent efficiency"
    [/(?<!\d)%/g, ' percent '],              // standalone % → percent
];

/**
 * Preprocess text for better TTS pronunciation
 * @param text The original text to be spoken
 * @returns Text with technical terms converted to speakable format
 */
export function preprocessForTTS(text: string): string {
    let result = text;

    for (const [pattern, replacement] of TTS_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }

    // Strip any Devanagari that leaked into the text (inline — no trim/collapse
    // to avoid altering intentional spacing from the rules above).
    result = result.replace(/[\u0900-\u097F]+/g, '');
    return result;
}

/**
 * Strip Devanagari script from TTS input.
 * AWS Polly Kajal Neural reads Devanagari character names aloud
 * rather than pronouncing Hindi words — this is a safety layer.
 * AlgoMind instructs Kai to use romanized Hinglish only, but if
 * Devanagari leaks through, this prevents broken TTS output.
 *
 * - Full Devanagari words are removed entirely (the English word
 *   in the same sentence provides context).
 * - Isolated Devanagari characters (punctuation, matras) are also stripped.
 * - Multiple spaces resulting from removal are collapsed.
 */
export function stripDevanagariForTTS(text: string): string {
    // Remove sequences of Devanagari characters (including matras/nukta)
    // Unicode block: \u0900-\u097F (Devanagari) + common extensions
    return text
        .replace(/[\u0900-\u097F]+/g, '')   // Remove Devanagari runs
        .replace(/ {2,}/g, ' ')             // Collapse multiple spaces from removal
        .trim();                             // Strip leading/trailing whitespace
}
