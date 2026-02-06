
/**
 * Utility functions for voice management
 */

// Common English/Hindi variants to look for
const TARGET_LOCALES = ['en-US', 'en-GB', 'en-IN', 'hi-IN'];

/**
 * loads and filters available voices with smart deduplication
 * Goal: Return ~5 high-quality, distinct options
 */
export const getProcesedVoices = (allVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] => {
    if (!allVoices || allVoices.length === 0) return [];

    // 1. Filter for target languages
    let filtered = allVoices.filter(v =>
        TARGET_LOCALES.includes(v.lang) ||
        v.lang.startsWith('en') ||
        v.lang.startsWith('hi') // Hindi
    );

    // 2. Smart Deduplication
    // Group by name similarity to remove "Google US English" vs "Google US English (Network)"
    const uniqueMap = new Map<string, SpeechSynthesisVoice>();

    filtered.forEach(voice => {
        // Normalize name: "Google US English" -> "googleusenglish"
        const cleanName = voice.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        // If we already have a voice with this "clean name", usually keep the shorter one
        // (often non-network/local versions have simpler names or are preferred)
        // BUT, sometimes "Google US English" is better than "English United States".
        // Heuristic: Prefer "Google" or "Microsoft" branded ones if available.

        if (!uniqueMap.has(cleanName)) {
            uniqueMap.set(cleanName, voice);
        } else {
            const existing = uniqueMap.get(cleanName)!;
            // If new one is "Google" and existing is generic, replace
            if (voice.name.includes('Google') && !existing.name.includes('Google')) {
                uniqueMap.set(cleanName, voice);
            }
        }
    });

    let distinctVoices = Array.from(uniqueMap.values());

    // 3. Sort by priority
    // Order: US -> UK -> India (English) -> Hindi -> Others
    distinctVoices.sort((a, b) => {
        const getScore = (v: SpeechSynthesisVoice) => {
            if (v.lang === 'en-US') return 1;
            if (v.lang === 'en-GB') return 2;
            if (v.lang === 'en-IN') return 3;
            if (v.lang === 'hi-IN') return 4;
            return 5;
        };

        const scoreA = getScore(a);
        const scoreB = getScore(b);

        if (scoreA !== scoreB) return scoreA - scoreB;
        return a.name.localeCompare(b.name);
    });

    // 4. Ensure diversity (try to keep at least one of each target locale if available)
    // If we have too many, limit but ensure we don't drop a unique locale
    if (distinctVoices.length > 8) {
        // Keep top 8 but ensure diversity
        const finalSet = new Set<SpeechSynthesisVoice>();
        // Add first of each target locale
        TARGET_LOCALES.forEach(locale => {
            const v = distinctVoices.find(dv => dv.lang === locale);
            if (v) finalSet.add(v);
        });
        // Fill rest
        distinctVoices.forEach(v => {
            if (finalSet.size < 8) finalSet.add(v);
        });
        distinctVoices = Array.from(finalSet);
    }

    // Fallback: If < 2 voices, give everything we filtered
    if (distinctVoices.length < 2 && filtered.length > 0) {
        return filtered.slice(0, 5);
    }

    return distinctVoices;
};

/**
 * Finds the best matching voice from a preference string
 */
export const findBestMatchingVoice = (voices: SpeechSynthesisVoice[], preferredName: string | null): SpeechSynthesisVoice | null => {
    if (!voices.length) return null;

    // 1. Exact Name Match
    if (preferredName) {
        const exact = voices.find(v => v.name === preferredName);
        if (exact) return exact;
    }

    // 2. Fallback to defaults
    // US English -> Microsoft Zira -> Any English -> Hindi
    return voices.find(v => v.name.includes("Google US English")) ||
        voices.find(v => v.name.includes("Microsoft Zira")) ||
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en')) ||
        voices.find(v => v.lang.startsWith('hi')) ||
        voices[0];
};
