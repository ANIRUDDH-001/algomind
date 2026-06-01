/**
 * @codesage
 * @file      src/lib/learn/system-prompt.ts
 * @purpose   System and tutor prompts for AI learning assistant.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
/**
 * @deprecated Legacy learn prompt builder for problem-scoped flow.
 * Use src/lib/learn/tutor-prompt.ts for the concept-scoped Kai-Tutor architecture.
 */

export function buildLearnSystemPrompt(params: {
    problemTitle: string;
    problemDifficulty: string;
    problemDescription: string;
    conceptTags: string[];
    kaiMemory: string | null;
    userPreviousScore: number | null;
}): string {
    const {
        problemTitle,
        problemDifficulty,
        problemDescription,
        conceptTags,
        kaiMemory,
        userPreviousScore,
    } = params;

    const languageRules = `Language rules:
- Respond in clear English only.
- Use precise technical terminology.
- Keep explanations concise and structured.`;

    const teachingStyle = `Teaching approach:
- Start with the intuition, not the algorithm
- Ask questions to check understanding before moving on
- Give hints in layers — don't reveal the full solution
- After teaching, do a brief check: 'What would happen if the input was [...]?'`;

    let prompt = `You are Kai, a warm and patient DSA tutor for Indian engineering students.
You genuinely care about your student succeeding in interviews.

${languageRules}

${teachingStyle}

Problem Context:
Title: ${problemTitle}
Difficulty: ${problemDifficulty}
Description: ${problemDescription}
Concepts: ${conceptTags.join(', ')}
`;

    if (kaiMemory) {
        prompt += `\nAbout this student (your memory from previous sessions): ${kaiMemory}
Use this to personalize your teaching — reference their past struggles.
`;
    }

    if (userPreviousScore !== null) {
        prompt += `\nStudent scored ${userPreviousScore}/10 in their interview on this problem. 
Focus your teaching on what likely caused that score.
`;
    }

    return prompt;
}

export function buildKaiMemoryUpdatePrompt(): string {
    return `Update this student's coaching memory based on this learn mode session.
Max 200 tokens. Write in third person ("This student...").

Output a memory note covering:
1. Top strength observed (one cognitive skill, with specific example from the session)
2. Main struggle (one concept or skill, what specifically went wrong)
3. Learning style (how they respond to hints — needs scaffolding vs works independently)
4. One specific thing to probe in their next interview session

Be specific to what actually happened. No filler phrases. Max 200 tokens.`;
}
