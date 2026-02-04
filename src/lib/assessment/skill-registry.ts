import { CognitiveSkill, SkillDefinition } from '@/types/assessment';

export const SKILL_DEFINITIONS: Record<CognitiveSkill, SkillDefinition> = {
    'problem-decomposition': {
        id: 'problem-decomposition',
        name: 'Problem Decomposition',
        description: 'Ability to break complex problems into manageable subproblems',
        color: '#3b82f6', // blue-500
        weight: 0.15,
        rubric: {
            level1: 'Cannot break down the problem; attempts to solve entire problem at once',
            level2: 'Identifies some subproblems but misses key components or logical steps',
            level3: 'Breaks problem into logical parts with minor gaps in dependency handling',
            level4: 'Clear decomposition with well-defined subproblems and clear interfaces',
            level5: 'Exemplary decomposition; identifies all edge cases, sub-problems, and dependencies immediately',
        },
    },

    'pattern-recognition': {
        id: 'pattern-recognition',
        name: 'Pattern Recognition',
        description: 'Recognizing algorithmic patterns and data structure applications',
        color: '#8b5cf6', // violet-500
        weight: 0.15,
        rubric: {
            level1: 'Does not recognize any common patterns or appropriate data structures',
            level2: 'Recognizes obvious patterns only with heavy prompting or explicit hints',
            level3: 'Identifies standard patterns (two-pointer, sliding window, etc.) after exploration',
            level4: 'Quickly recognizes patterns and suggests appropriate approaches with justification',
            level5: 'Identifies subtle patterns even in obfuscated problems; adapts solutions creatively',
        },
    },

    'algorithmic-thinking': {
        id: 'algorithmic-thinking',
        name: 'Algorithmic Thinking',
        description: 'Designing efficient algorithms and choosing correct approaches',
        color: '#ec4899', // pink-500
        weight: 0.15,
        rubric: {
            level1: 'No clear algorithmic approach; relies on trial and error or random guesses',
            level2: 'Has basic approach but it is fundamentally inefficient or logically flawed',
            level3: 'Proposes a working algorithm with room for optimization (brute force to better)',
            level4: 'Designs efficient algorithm with clear logic and considers constraints',
            level5: 'Optimal algorithm designed from first principles; considers multiple valid approaches',
        },
    },

    'complexity-analysis': {
        id: 'complexity-analysis',
        name: 'Complexity Analysis',
        description: 'Analyzing time and space complexity accurately',
        color: '#10b981', // emerald-500
        weight: 0.12,
        rubric: {
            level1: 'Cannot analyze complexity or provides consistently incorrect Big O notation',
            level2: 'Rough complexity estimate with significant errors in reasoning',
            level3: 'Correct complexity for simple cases; struggles with non-trivial recursions',
            level4: 'Accurate analysis for most scenarios including standard recursion and sorting',
            level5: 'Precise analysis including amortized complexity and nuanced space-time tradeoffs',
        },
    },

    'communication-clarity': {
        id: 'communication-clarity',
        name: 'Communication Clarity',
        description: 'Explaining thought process clearly and concisely',
        color: '#f59e0b', // amber-500
        weight: 0.12,
        rubric: {
            level1: 'Incoherent explanation; difficult for the interviewer to follow the logic',
            level2: 'Explains with many pauses, self-corrections, or obvious confusion',
            level3: 'Clear explanation but could be more structured or uses technical jargon poorly',
            level4: 'Well-structured explanation that guides the listener through the decision map',
            level5: 'Exceptionally clear and engaging; uses analogies and "voice-visualizations"',
        },
    },

    'edge-case-awareness': {
        id: 'edge-case-awareness',
        name: 'Edge Case Awareness',
        description: 'Identifying and handling edge cases proactively',
        color: '#06b6d4', // cyan-500
        weight: 0.10,
        rubric: {
            level1: 'Does not consider edge cases at all; solution fails on simplest variations',
            level2: 'Identifies edge cases only when prompted explicitly by the interviewer',
            level3: 'Mentions some edge cases (nulls, empty) but misses crucial logic-specific ones',
            level4: 'Proactively identifies most edge cases before fully committing to code',
            level5: 'Comprehensive edge case analysis; builds robustness into the initial design',
        },
    },

    'optimization-mindset': {
        id: 'optimization-mindset',
        name: 'Optimization Mindset',
        description: 'Thinking about performance and optimization opportunities',
        color: '#6366f1', // indigo-500
        weight: 0.11,
        rubric: {
            level1: 'No consideration for optimization; stops at the first working solution',
            level2: 'Mentions optimization but has no concrete ideas on how to achieve it',
            level3: 'Identifies some optimization opportunities but struggles to implement them',
            level4: 'Proposes multiple optimization strategies and can articulate their impact',
            level5: 'Discusses complex tradeoffs (CPU vs Memory) and finds optimal solutions',
        },
    },

    'debugging-approach': {
        id: 'debugging-approach',
        name: 'Debugging Approach',
        description: 'Systematic approach to finding and fixing bugs',
        color: '#ef4444', // red-500
        weight: 0.10,
        rubric: {
            level1: 'Randomly changes code hoping for a solution; lacks any mental model',
            level2: 'Attempts debugging but lacks a systematic approach to isolate the root cause',
            level3: 'Uses basic debugging techniques like tracing values for test cases',
            level4: 'Systematic debugging with hypothesis testing and logical elimination',
            level5: 'Proactive bug prevention; deep root-cause analysis even for edge cases',
        },
    },
};
