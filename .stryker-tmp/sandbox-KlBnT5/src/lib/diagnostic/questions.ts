/**
 * @codesage
 * @file      src/lib/diagnostic/questions.ts
 * @purpose   Handles diagnostic questions.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

/**
 * Standardized diagnostic questions with 1-5 scale answers
 * Each question maps to specific DSA concepts
 * User selects 1-5 which directly maps to confidence score:
 * 1 = 0.20, 2 = 0.35, 3 = 0.50, 4 = 0.70, 5 = 0.90
 */

export type DiagnosticAnswer = {
  value: 1 | 2 | 3 | 4 | 5;
  label: string;
  color: string; // Tailwind color for visual feedback
};

export type DiagnosticQuestion = {
  id: number;
  title: string;
  description?: string;
  concepts: string[];
  isMeta?: boolean; // Meta-skills apply to all concepts with dampening
  answers: DiagnosticAnswer[];
};

const SCALE_COLORS = {
  1: 'bg-red-600 hover:bg-red-700',
  2: 'bg-orange-500 hover:bg-orange-600',
  3: 'bg-yellow-500 hover:bg-yellow-600',
  4: 'bg-green-600 hover:bg-green-700',
  5: 'bg-emerald-600 hover:bg-emerald-700',
};

//  -- automated unused local suppression
const STANDARD_ANSWERS: { [key: number]: DiagnosticAnswer } = {
  1: { value: 1, label: 'Very Weak', color: SCALE_COLORS[1] },
  2: { value: 2, label: 'Weak', color: SCALE_COLORS[2] },
  3: { value: 3, label: 'Moderate', color: SCALE_COLORS[3] },
  4: { value: 4, label: 'Strong', color: SCALE_COLORS[4] },
  5: { value: 5, label: 'Expert', color: SCALE_COLORS[5] },
};

export const DIAGNOSTIC_QUESTIONS: DiagnosticQuestion[] = [
  {
    id: 1,
    title: 'Arrays & Strings',
    description: 'How do you approach array and string problems?',
    concepts: ['arrays-strings'],
    answers: [
      { value: 1, label: 'Struggle to start, need hints', color: SCALE_COLORS[1] },
      { value: 2, label: 'Can solve with significant effort', color: SCALE_COLORS[2] },
      { value: 3, label: 'Comfortable, solve with minor optimizations', color: SCALE_COLORS[3] },
      { value: 4, label: 'Strong, quickly optimize solutions', color: SCALE_COLORS[4] },
      { value: 5, label: 'Expert, solve optimally on first attempt', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 2,
    title: 'Hashmaps & Sets',
    description: 'How comfortable are you with hashmaps and sets?',
    concepts: ['hashmaps-sets'],
    answers: [
      { value: 1, label: 'Avoid using them', color: SCALE_COLORS[1] },
      { value: 2, label: 'Use sometimes, often uncertain', color: SCALE_COLORS[2] },
      { value: 3, label: 'Good grasp, use regularly', color: SCALE_COLORS[3] },
      { value: 4, label: 'Strong understanding, quick to apply', color: SCALE_COLORS[4] },
      { value: 5, label: 'Mastery, always optimal use', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 3,
    title: 'Two-Pointers & Sliding Window',
    description: 'How comfortable are you with two-pointers and sliding window techniques?',
    concepts: ['two-pointers', 'sliding-window'],
    answers: [
      { value: 1, label: 'Never used them effectively', color: SCALE_COLORS[1] },
      { value: 2, label: 'Rarely use, struggle to apply', color: SCALE_COLORS[2] },
      { value: 3, label: 'Regular use, comfortable implementation', color: SCALE_COLORS[3] },
      { value: 4, label: "Go-to patterns, instinctive choice", color: SCALE_COLORS[4] },
      { value: 5, label: 'Expert, handle complex variants easily', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 4,
    title: 'Trees, Graphs & Recursion',
    description: 'How do you decide between recursion and iterative approaches for trees and graphs?',
    concepts: ['trees-traversal', 'graphs-bfs-dfs'],
    answers: [
      { value: 1, label: 'Often confused about which to use', color: SCALE_COLORS[1] },
      { value: 2, label: 'Understand basics, inconsistent choice', color: SCALE_COLORS[2] },
      { value: 3, label: 'Can choose appropriately usually', color: SCALE_COLORS[3] },
      { value: 4, label: 'Instinctive choice, quick implementation', color: SCALE_COLORS[4] },
      { value: 5, label: 'Fluent in both, optimize for specific scenarios', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 5,
    title: 'Dynamic Programming',
    description: 'How confident are you with dynamic programming state design and transitions?',
    concepts: ['dynamic-programming'],
    answers: [
      { value: 1, label: 'Unknown territory for me', color: SCALE_COLORS[1] },
      { value: 2, label: 'Exposure but struggle with design', color: SCALE_COLORS[2] },
      { value: 3, label: 'Moderate understanding, can solve basic problems', color: SCALE_COLORS[3] },
      { value: 4, label: 'Strong design instincts, rarely stuck', color: SCALE_COLORS[4] },
      { value: 5, label: 'Optimal solutions on first attempt', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 6,
    title: 'Binary Search',
    description: 'How familiar are you with binary search and sorted data manipulation?',
    concepts: ['binary-search'],
    answers: [
      { value: 1, label: 'Never tried, seems complex', color: SCALE_COLORS[1] },
      { value: 2, label: 'Know basics, struggle with edge cases', color: SCALE_COLORS[2] },
      { value: 3, label: 'Can solve standard problems', color: SCALE_COLORS[3] },
      { value: 4, label: 'Reliable, handle variants', color: SCALE_COLORS[4] },
      { value: 5, label: 'Instinctive, master edge cases', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 7,
    title: 'Edge Case Validation',
    description: 'How rigorous are you with edge case testing before finalizing code?',
    concepts: ['arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window', 'trees-traversal', 'graphs-bfs-dfs', 'dynamic-programming', 'binary-search'],
    isMeta: true,
    answers: [
      { value: 1, label: 'Skip testing, trust initial logic', color: SCALE_COLORS[1] },
      { value: 2, label: 'Minimal testing, miss some cases', color: SCALE_COLORS[2] },
      { value: 3, label: 'Adequate testing, usually sufficient', color: SCALE_COLORS[3] },
      { value: 4, label: 'Thorough, systematic approach', color: SCALE_COLORS[4] },
      { value: 5, label: 'Flawless, comprehensive test strategy', color: SCALE_COLORS[5] },
    ],
  },
  {
    id: 8,
    title: 'Complexity Analysis',
    description: 'How strong is your complexity analysis under interview pressure?',
    concepts: ['arrays-strings', 'hashmaps-sets', 'two-pointers', 'sliding-window', 'trees-traversal', 'graphs-bfs-dfs', 'dynamic-programming', 'binary-search'],
    isMeta: true,
    answers: [
      { value: 1, label: "Can't analyze accurately", color: SCALE_COLORS[1] },
      { value: 2, label: 'Guess often, sometimes correct', color: SCALE_COLORS[2] },
      { value: 3, label: 'Usually right, occasional mistakes', color: SCALE_COLORS[3] },
      { value: 4, label: 'Fast analysis, reliable under pressure', color: SCALE_COLORS[4] },
      { value: 5, label: 'Flawless, articulate clearly', color: SCALE_COLORS[5] },
    ],
  },
];

/**
 * Map selected value (1-5) to confidence score
 */
export function mapValueToConfidence(value: 1 | 2 | 3 | 4 | 5): number {
  const confidenceMap: { [key: number]: number } = {
    1: 0.20,
    2: 0.35,
    3: 0.50,
    4: 0.70,
    5: 0.90,
  };
  return confidenceMap[value];
}

/**
 * For meta-skill questions, apply dampening so they boost but don't override base answers
 */
export function applyMetaDampening(baseConfidence: number, metaValue: number): number {
  const metaBaseConfidence = mapValueToConfidence(metaValue as 1 | 2 | 3 | 4 | 5);
  // Meta-skills contribute 0.1 * (meta_confidence - 0.5) so they boost/penalty by at most ±0.05
  const metaAdjustment = (metaBaseConfidence - 0.5) * 0.1;
  return Math.max(0.2, Math.min(0.9, baseConfidence + metaAdjustment));
}

export const TOTAL_DIAGNOSTIC_QUESTIONS = DIAGNOSTIC_QUESTIONS.length;
