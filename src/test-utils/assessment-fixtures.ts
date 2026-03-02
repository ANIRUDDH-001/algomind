/**
 * Shared test fixtures for assessment-related tests.
 * Provides realistic mock data for all 8 skills with sub-criteria.
 */

import type { AssessmentResult } from '@/lib/assessment/analyzer';
import type { CognitiveSkill } from '@/types/assessment';

export const MOCK_PROBLEM = {
    id: 'two-sum',
    title: 'Two Sum',
    description: '...',
    content: '...',
    difficulty: 'easy' as const,
    timeLimitMs: 60 * 60 * 1000,
    starterCode: { python: 'def twoSum(nums, target): pass' }
};

export const MOCK_FULL_ASSESSMENT: AssessmentResult = {
    sessionId: 'test-session-001',
    timestamp: new Date('2025-01-15T10:00:00Z'),
    problem: MOCK_PROBLEM,
    skills: {
        'problem-decomposition': {
            score: 7.5,
            evidence: ['Candidate asked "can the array have duplicates?" before starting'],
            strengths: ['Clarified constraints upfront'],
            improvements: [],
            confidence: 0.85,
        },
        'pattern-recognition': {
            score: 6.0,
            evidence: ['Identified hash map approach after 2 minutes'],
            strengths: [],
            improvements: ['Did not initially recognise Two Pointer as alternative'],
            confidence: 0.8,
        },
        'algorithmic-thinking': {
            score: 8.0,
            evidence: ['Designed clear O(N) solution map logic'],
            strengths: ['Clear step-by-step logic framing'],
            improvements: [],
            confidence: 0.9,
        },
        'complexity-analysis': {
            score: 7.0,
            evidence: ['Correctly identified O(N) time and space'],
            strengths: [],
            improvements: ['Did not discuss amortized map operations'],
            confidence: 0.8,
        },
        'communication-clarity': {
            score: 9.0,
            evidence: ['Walked through examples out loud'],
            strengths: ['Excellent vocalized thinking process'],
            improvements: [],
            confidence: 0.95,
        },
        'edge-case-awareness': {
            score: 6.5,
            evidence: ['Handled normal cases but missed null/empty checks'],
            strengths: [],
            improvements: ['Needs faster upfront validation mapping'],
            confidence: 0.75,
        },
        'optimization-mindset': {
            score: 8.0,
            evidence: ['Moved past brute force very quickly to one-pass map'],
            strengths: ['Natural optimization intuition'],
            improvements: [],
            confidence: 0.85,
        },
        'debugging-approach': {
            score: 7.0,
            evidence: ['Fixed small index offset intuitively during dry run'],
            strengths: ['Solid dry-run verification'],
            improvements: [],
            confidence: 0.8,
        },
    } as Record<CognitiveSkill, any>,
    overallFeedback: 'Strong overall performance with good clarification habits.',
    nextSteps: ['Practice complexity analysis on medium problems'],
    overallScore: 7.5,
    rawScore: 7.5,
    adjustedScore: 7.5,
};

export const MOCK_WEAK_ASSESSMENT: AssessmentResult = {
    sessionId: 'test-session-002',
    timestamp: new Date('2025-01-15T11:00:00Z'),
    problem: MOCK_PROBLEM,
    skills: {
        'problem-decomposition': { score: 3.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'pattern-recognition': { score: 2.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'algorithmic-thinking': { score: 4.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'complexity-analysis': { score: 2.5, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'communication-clarity': { score: 3.5, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'edge-case-awareness': { score: 2.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'optimization-mindset': { score: 2.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
        'debugging-approach': { score: 3.0, evidence: [], strengths: [], improvements: [], confidence: 0.5 },
    } as Record<CognitiveSkill, any>,
    overallFeedback: 'Need to communicate more effectively and structure thoughts.',
    nextSteps: ['Start by explicitly listing constraints out loud.'],
    overallScore: 2.5,
    rawScore: 2.5,
    adjustedScore: 2.5,
};

export const MOCK_TRANSCRIPT_SHORT = [
    { role: 'assistant' as const, content: 'Welcome! Here is the problem: Two Sum...' },
    { role: 'user' as const, content: 'I think I will use a loop' },
    { role: 'assistant' as const, content: 'Can you tell me more about your approach?' },
    { role: 'user' as const, content: 'Just loop through and check' },
];

export const MOCK_TRANSCRIPT_FULL = [
    { role: 'assistant' as const, content: 'Welcome! Here is the problem: Two Sum...' },
    { role: 'user' as const, content: 'So the goal is to find two numbers that add up to target?' },
    { role: 'assistant' as const, content: 'Exactly. How would you start?' },
    { role: 'user' as const, content: 'I could use two nested loops.' },
    { role: 'assistant' as const, content: 'What is the time complexity of that?' },
    { role: 'user' as const, content: 'It would be O(N^2).' },
    { role: 'assistant' as const, content: 'Can we do better?' },
    { role: 'user' as const, content: 'Yes, I can use a hash map to store the complements.' },
    { role: 'assistant' as const, content: 'Great, how does that improve complexity?' },
    { role: 'user' as const, content: 'It becomes O(N) time and O(N) space.' },
    { role: 'assistant' as const, content: 'Any edge cases?' },
    { role: 'user' as const, content: 'What if the array is empty?' },
    { role: 'assistant' as const, content: 'Good catch. Go ahead and write the code.' },
    { role: 'user' as const, content: '```python\ndef twoSum(nums, target):\n  d = {}\n  for i, n in enumerate(nums):\n    if target - n in d:\n      return [d[target-n], i]\n    d[n] = i\n```' },
    { role: 'assistant' as const, content: 'Looks correct.' },
];

export function makeMockSession(overrides = {}) {
    return {
        id: 'session-' + Math.random().toString(36).substr(2, 9),
        problemTitle: 'Two Sum',
        problemDifficulty: 'easy' as const,
        difficultyMode: 'practice' as const,
        overallScore: 6.5,
        ...overrides,
    };
}
