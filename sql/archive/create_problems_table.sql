-- AlgoMind Problems Table Setup
-- Run this in Supabase SQL Editor

-- Create problems table
CREATE TABLE IF NOT EXISTS public.problems (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('easy', 'medium', 'hard')) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  hints TEXT[] DEFAULT '{}',
  examples JSONB DEFAULT '[]',
  constraints TEXT,
  time_complexity TEXT,
  space_complexity TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);  

-- Enable Row Level Security
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (safe re-run)
DROP POLICY IF EXISTS "Anyone can view problems" ON public.problems;
DROP POLICY IF EXISTS "Anonymous can view problems" ON public.problems;

-- Allow all authenticated users to read problems
CREATE POLICY "Anyone can view problems"
  ON public.problems FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anonymous users to view problems (for guest mode)
CREATE POLICY "Anonymous can view problems"
  ON public.problems FOR SELECT
  TO anon
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_problems_difficulty ON public.problems(difficulty);
CREATE INDEX IF NOT EXISTS idx_problems_tags ON public.problems USING gin(tags);

-- Insert sample problems
INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples) VALUES
(
  'two-sum',
  'Two Sum',
  'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.',
  'easy',
  ARRAY['array', 'hash-table'],
  ARRAY['Use a hash map to store numbers you''ve seen', 'For each number, check if target - number exists in the map'],
  '[
    {
      "input": "nums = [2,7,11,15], target = 9",
      "output": "[0,1]",
      "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."
    },
    {
      "input": "nums = [3,2,4], target = 6",
      "output": "[1,2]"
    }
  ]'::jsonb
),
(
  'valid-parentheses',
  'Valid Parentheses',
  'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.',
  'easy',
  ARRAY['string', 'stack'],
  ARRAY['Use a stack to track opening brackets', 'When you see a closing bracket, check if it matches the last opening bracket'],
  '[
    {
      "input": "s = \"()\"",
      "output": "true"
    },
    {
      "input": "s = \"()[]{}\"",
      "output": "true"
    },
    {
      "input": "s = \"(]\"",
      "output": "false"
    }
  ]'::jsonb
),
(
  'merge-intervals',
  'Merge Intervals',
  'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.',
  'medium',
  ARRAY['array', 'sorting'],
  ARRAY['Sort intervals by start time', 'Iterate through sorted intervals and merge if they overlap'],
  '[
    {
      "input": "intervals = [[1,3],[2,6],[8,10],[15,18]]",
      "output": "[[1,6],[8,10],[15,18]]"
    }
  ]'::jsonb
),
(
  'longest-substring',
  'Longest Substring Without Repeating Characters',
  'Given a string s, find the length of the longest substring without repeating characters.',
  'medium',
  ARRAY['string', 'sliding-window', 'hash-table'],
  ARRAY['Use sliding window technique', 'Keep track of characters seen with a hash map', 'Move window when duplicate found'],
  '[
    {
      "input": "s = \"abcabcbb\"",
      "output": "3",
      "explanation": "The answer is \"abc\", with the length of 3."
    },
    {
      "input": "s = \"bbbbb\"",
      "output": "1"
    }
  ]'::jsonb
),
(
  'binary-tree-traversal',
  'Binary Tree Inorder Traversal',
  'Given the root of a binary tree, return the inorder traversal of its nodes'' values.',
  'easy',
  ARRAY['tree', 'depth-first-search', 'recursion'],
  ARRAY['Use recursive approach: left -> root -> right', 'Alternatively use iterative approach with a stack'],
  '[
    {
      "input": "root = [1,null,2,3]",
      "output": "[1,3,2]"
    }
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create function to get random problem by difficulty
CREATE OR REPLACE FUNCTION get_random_problem(problem_difficulty TEXT DEFAULT NULL)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  description TEXT,
  difficulty TEXT,
  tags TEXT[],
  hints TEXT[],
  examples JSONB
) AS $$
BEGIN
  IF problem_difficulty IS NULL THEN
    RETURN QUERY
    SELECT p.id, p.title, p.description, p.difficulty, p.tags, p.hints, p.examples
    FROM public.problems p
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT p.id, p.title, p.description, p.difficulty, p.tags, p.hints, p.examples
    FROM public.problems p
    WHERE p.difficulty = problem_difficulty
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;
