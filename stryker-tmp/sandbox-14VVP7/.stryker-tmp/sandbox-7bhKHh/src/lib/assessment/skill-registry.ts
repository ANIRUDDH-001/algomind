/**
 * @codesage
 * @file      src/lib/assessment/skill-registry.ts
 * @purpose   Defines the authoritative cognitive skills taxonomy, weights, and scoring rubrics
 * @tech      None
 * @connects  imports CognitiveSkill, SkillDefinition, COLORS
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { CognitiveSkill, SkillDefinition } from '@/types/assessment';
import { COLORS } from '@/lib/design-tokens';
export const SKILL_DEFINITIONS: Record<CognitiveSkill, SkillDefinition> = {
    'problem-decomposition': {
        id: 'problem-decomposition',
        name: 'Problem Decomposition',
        description: 'Ability to break complex problems into manageable subproblems',
        color: COLORS.skills['problem-decomposition'], // blue-500
        weight: 0.15,
        rubric: {
            level1: 'Cannot break down the problem; attempts to solve entire problem at once',
            level2: 'Identifies some subproblems but misses key components or logical steps',
            level3: 'Breaks problem into logical parts with minor gaps in dependency handling',
            level4: 'Clear decomposition with well-defined subproblems and clear interfaces',
            level5: 'Exemplary decomposition; identifies all edge cases, sub-problems, and dependencies immediately',
        },
        subCriteria: [
            { id: 'clarifiesAmbiguity', label: 'Clarifies Ambiguity', weight: 0.30, description: 'Asked clarifying questions before diving in' },
            { id: 'identifiesSubproblems', label: 'Identifies Subproblems', weight: 0.30, description: 'Explicitly broke problem into named sub-steps' },
            { id: 'definesInterfaces', label: 'Defines Interfaces', weight: 0.20, description: 'Defined inputs/outputs for each sub-step' },
            { id: 'handlesDependencies', label: 'Handles Dependencies', weight: 0.20, description: 'Addressed ordering/dependency between parts' },
        ],
    },

    'pattern-recognition': {
        id: 'pattern-recognition',
        name: 'Pattern Recognition',
        description: 'Recognizing algorithmic patterns and data structure applications',
        color: COLORS.skills['pattern-recognition'], // violet-500
        weight: 0.15,
        rubric: {
            level1: 'Does not recognize any common patterns or appropriate data structures',
            level2: 'Recognizes obvious patterns only with heavy prompting or explicit hints',
            level3: 'Identifies standard patterns (two-pointer, sliding window, etc.) after exploration',
            level4: 'Quickly recognizes patterns and suggests appropriate approaches with justification',
            level5: 'Identifies subtle patterns even in obfuscated problems; adapts solutions creatively',
        },
        subCriteria: [
            { id: 'namesPattern', label: 'Names Pattern', weight: 0.30, description: 'Explicitly named algorithm pattern (e.g. sliding window)' },
            { id: 'justifiesFit', label: 'Justifies Fit', weight: 0.30, description: 'Explained WHY pattern applies to this problem' },
            { id: 'unprompted', label: 'Without Prompting', weight: 0.25, description: 'Identified pattern before being asked' },
            { id: 'generalisesVariant', label: 'Generalises to Variants', weight: 0.15, description: 'Connected pattern to related problems or variations' },
        ],
    },

    'algorithmic-thinking': {
        id: 'algorithmic-thinking',
        name: 'Algorithmic Thinking',
        description: 'Designing efficient algorithms and choosing correct approaches',
        color: COLORS.skills['algorithmic-thinking'], // pink-500
        weight: 0.15,
        rubric: {
            level1: 'No clear algorithmic approach; relies on trial and error or random guesses',
            level2: 'Has basic approach but it is fundamentally inefficient or logically flawed',
            level3: 'Proposes a working algorithm with room for optimization (brute force to better)',
            level4: 'Designs efficient algorithm with clear logic and considers constraints',
            level5: 'Optimal algorithm designed from first principles; considers multiple valid approaches',
        },
        subCriteria: [
            { id: 'proposesWorkingAlgo', label: 'Proposes Working Algo', weight: 0.35, description: 'Stated a concrete algorithm that would solve the problem' },
            { id: 'avoidsFlawedApproach', label: 'Avoids Flawed Approach', weight: 0.20, description: 'Did not pursue a fundamentally broken path' },
            { id: 'articulatesSteps', label: 'Articulates Steps', weight: 0.25, description: 'Described step-by-step logic verbally before coding' },
            { id: 'considersAlternatives', label: 'Considers Alternatives', weight: 0.20, description: 'Mentioned at least one other valid approach' },
        ],
    },

    'complexity-analysis': {
        id: 'complexity-analysis',
        name: 'Complexity Analysis',
        description: 'Analyzing time and space complexity accurately',
        color: COLORS.skills['complexity-analysis'], // emerald-500
        weight: 0.12,
        rubric: {
            level1: 'Cannot analyze complexity or provides consistently incorrect Big O notation',
            level2: 'Rough complexity estimate with significant errors in reasoning',
            level3: 'Correct complexity for simple cases; struggles with non-trivial recursions',
            level4: 'Accurate analysis for most scenarios including standard recursion and sorting',
            level5: 'Precise analysis including amortized complexity and nuanced space-time tradeoffs',
        },
        subCriteria: [
            { id: 'correctTimeComplexity', label: 'Correct Time Complexity', weight: 0.30, description: 'Stated correct Big-O time complexity' },
            { id: 'correctSpaceComplexity', label: 'Correct Space Complexity', weight: 0.20, description: 'Stated correct Big-O space complexity' },
            { id: 'explainsWhy', label: 'Explains Reasoning', weight: 0.30, description: 'Explained derivation, not just recited answer' },
            { id: 'handlesRecursion', label: 'Handles Recursion/Amort', weight: 0.20, description: 'Correctly handled recursion trees or amortized cases' },
        ],
    },

    'communication-clarity': {
        id: 'communication-clarity',
        name: 'Communication Clarity',
        description: 'Explaining thought process clearly and concisely',
        color: COLORS.skills['communication-clarity'], // amber-500
        weight: 0.12,
        rubric: {
            level1: 'Incoherent explanation; difficult for the interviewer to follow the logic',
            level2: 'Explains with many pauses, self-corrections, or obvious confusion',
            level3: 'Clear explanation but could be more structured or uses technical jargon poorly',
            level4: 'Well-structured explanation that guides the listener through the decision map',
            level5: 'Exceptionally clear and engaging; uses analogies and "voice-visualizations"',
        },
        subCriteria: [
            { id: 'thinksAloud', label: 'Thinks Aloud', weight: 0.35, description: 'Narrated thought process while coding or reasoning' },
            { id: 'correctTerminology', label: 'Correct Terminology', weight: 0.25, description: 'Used accurate CS/algorithm terminology' },
            { id: 'checksUnderstanding', label: 'Checks Understanding', weight: 0.20, description: 'Confirmed interviewer understanding at key points' },
            { id: 'structuredExplanation', label: 'Structured Explanation', weight: 0.20, description: 'Used clear logical structure (e.g. first/then/finally)' },
        ],
    },

    'edge-case-awareness': {
        id: 'edge-case-awareness',
        name: 'Edge Case Awareness',
        description: 'Identifying and handling edge cases proactively',
        color: COLORS.skills['edge-case-awareness'], // cyan-500
        weight: 0.10,
        rubric: {
            level1: 'Does not consider edge cases at all; solution fails on simplest variations',
            level2: 'Identifies edge cases only when prompted explicitly by the interviewer',
            level3: 'Mentions some edge cases (nulls, empty) but misses crucial logic-specific ones',
            level4: 'Proactively identifies most edge cases before fully committing to code',
            level5: 'Comprehensive edge case analysis; builds robustness into the initial design',
        },
        subCriteria: [
            { id: 'emptyInput', label: 'Empty Input', weight: 0.20, description: 'Addressed empty array/string/null input' },
            { id: 'singleElement', label: 'Single Element', weight: 0.20, description: 'Addressed single-element edge case' },
            { id: 'duplicatesOverflow', label: 'Duplicates/Overflow', weight: 0.25, description: 'Addressed duplicates, integer overflow, or boundary values' },
            { id: 'logicSpecificCases', label: 'Logic-Specific Cases', weight: 0.35, description: 'Identified edge cases specific to this problem\'s logic, not generic' },
        ],
    },

    'optimization-mindset': {
        id: 'optimization-mindset',
        name: 'Optimization Mindset',
        description: 'Thinking about performance and optimization opportunities',
        color: COLORS.skills['optimization-mindset'], // indigo-500
        weight: 0.11,
        rubric: {
            level1: 'No consideration for optimization; stops at the first working solution',
            level2: 'Mentions optimization but has no concrete ideas on how to achieve it',
            level3: 'Identifies some optimization opportunities but struggles to implement them',
            level4: 'Proposes multiple optimization strategies and can articulate their impact',
            level5: 'Discusses complex tradeoffs (CPU vs Memory) and finds optimal solutions',
        },
        subCriteria: [
            { id: 'identifiesBruteForce', label: 'States Brute Force', weight: 0.20, description: 'Explicitly identified and dismissed the naive solution' },
            { id: 'recognisesOpportunity', label: 'Recognises Opportunity', weight: 0.25, description: 'Identified that improvement was possible' },
            { id: 'articulatesTradeoff', label: 'Articulates Tradeoff', weight: 0.30, description: 'Explained the time/space tradeoff of the optimisation' },
            { id: 'implementsOrExplains', label: 'Implements/Explains', weight: 0.25, description: 'Either implemented optimisation or clearly explained how' },
        ],
    },

    'debugging-approach': {
        id: 'debugging-approach',
        name: 'Debugging Approach',
        description: 'Systematic approach to finding and fixing bugs',
        color: COLORS.skills['debugging-approach'], // red-500
        weight: 0.10,
        rubric: {
            level1: 'Randomly changes code hoping for a solution; lacks any mental model',
            level2: 'Attempts debugging but lacks a systematic approach to isolate the root cause',
            level3: 'Uses basic debugging techniques like tracing values for test cases',
            level4: 'Systematic debugging with hypothesis testing and logical elimination',
            level5: 'Proactive bug prevention; deep root-cause analysis even for edge cases',
        },
        subCriteria: [
            { id: 'tracesManually', label: 'Traces Manually', weight: 0.30, description: 'Traced through an example by hand to find issue' },
            { id: 'isolatesFailing', label: 'Isolates Failing Case', weight: 0.25, description: 'Identified the specific input that causes failure' },
            { id: 'formsHypothesis', label: 'Forms Hypothesis', weight: 0.30, description: 'Stated what they thought was wrong before changing code' },
            { id: 'verifiesFix', label: 'Verifies Fix', weight: 0.15, description: 'Re-ran or re-traced to confirm fix was correct' },
        ],
    },
};
