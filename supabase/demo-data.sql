-- ============================================
-- DEMO DATA SCRIPT FOR ALGOMIND
-- Run this AFTER running schema.sql
-- ============================================

-- STEP 1: First get your user ID
-- Run this query and copy your UUID:
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';

-- STEP 2: Replace 'YOUR_USER_ID_HERE' below with your actual UUID
-- Then run the entire script

DO $$
DECLARE
  -- REPLACE THIS WITH YOUR ACTUAL USER ID
  user_uuid UUID := 'YOUR_USER_ID_HERE';
  
  session_uuid UUID;
  base_scores DECIMAL[];
  difficulty TEXT;
  problem_names TEXT[];
BEGIN
  -- Check if user_uuid is valid
  IF user_uuid = 'YOUR_USER_ID_HERE'::UUID THEN
    RAISE EXCEPTION 'Please replace YOUR_USER_ID_HERE with your actual user UUID!';
  END IF;

  -- Define base skill scores (will improve over sessions)
  base_scores := ARRAY[5.5, 5.0, 5.8, 4.5, 6.0, 4.8, 5.2, 5.5];
  
  -- Problem names for realistic data
  problem_names := ARRAY[
    'Two Sum',
    'Valid Parentheses',
    'Merge Sorted Array',
    'Binary Search',
    'Linked List Cycle',
    'Maximum Subarray',
    'Climbing Stairs',
    'LRU Cache',
    'Word Search',
    'Serialize Binary Tree'
  ];

  -- Generate 10 interview sessions with progressive improvement
  FOR i IN 1..10 LOOP
    -- Determine difficulty based on progression
    IF i <= 3 THEN
      difficulty := 'easy';
    ELSIF i <= 7 THEN
      difficulty := 'medium';
    ELSE
      difficulty := 'hard';
    END IF;

    -- Create interview session
    INSERT INTO public.interview_sessions (
      user_id,
      problem_id,
      problem_title,
      problem_difficulty,
      started_at,
      completed_at,
      duration,
      status
    ) VALUES (
      user_uuid,
      'demo-problem-' || i,
      problem_names[i],
      difficulty,
      NOW() - INTERVAL '1 day' * (11 - i),
      NOW() - INTERVAL '1 day' * (11 - i) + INTERVAL '10 minutes',
      600 + (RANDOM() * 300)::INT,  -- 10-15 minutes
      'completed'
    ) RETURNING id INTO session_uuid;

    -- Create assessment with progressive improvement
    -- Each session improves scores slightly
    INSERT INTO public.assessments (
      session_id,
      user_id,
      problem_decomposition,
      pattern_recognition,
      algorithmic_thinking,
      complexity_analysis,
      communication_clarity,
      edge_case_awareness,
      optimization_mindset,
      debugging_approach,
      overall_score,
      overall_feedback,
      next_steps,
      model_used,
      confidence
    ) VALUES (
      session_uuid,
      user_uuid,
      -- Progressive improvement formula: base + (session * 0.35) + random variance
      LEAST(10, base_scores[1] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[2] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[3] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[4] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[5] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[6] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[7] + (i * 0.35) + (RANDOM() * 0.5)),
      LEAST(10, base_scores[8] + (i * 0.35) + (RANDOM() * 0.5)),
      -- Overall score
      LEAST(10, 5.0 + (i * 0.4) + (RANDOM() * 0.5)),
      -- Feedback based on difficulty
      CASE difficulty
        WHEN 'easy' THEN 'Good understanding of basic concepts. Continue practicing to build confidence.'
        WHEN 'medium' THEN 'Solid problem-solving approach. Focus on optimization and edge cases.'
        ELSE 'Excellent handling of complex problems. Ready for advanced challenges!'
      END,
      -- Next steps
      ARRAY[
        'Practice more ' || difficulty || ' level problems',
        'Focus on time complexity analysis',
        'Work on explaining your thought process clearly'
      ],
      'gemini-2.0-flash',
      0.85 + (RANDOM() * 0.1)
    );

    RAISE NOTICE 'Created session % with difficulty %', i, difficulty;
  END LOOP;

  RAISE NOTICE 'Successfully created 10 demo sessions for user %', user_uuid;
END $$;

-- ============================================
-- VERIFY DATA WAS CREATED
-- Run these queries to check:
-- ============================================

-- Check sessions:
-- SELECT id, problem_title, problem_difficulty, completed_at 
-- FROM interview_sessions 
-- ORDER BY completed_at DESC 
-- LIMIT 10;

-- Check assessments:
-- SELECT session_id, overall_score, problem_decomposition, pattern_recognition 
-- FROM assessments 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Check progress view:
-- SELECT * FROM user_progress WHERE user_id = 'YOUR_USER_ID_HERE';
