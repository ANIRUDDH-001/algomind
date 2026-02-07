-- 04_seeds.sql
-- Initial Data Population

-- ============================================================
-- 1. ADMIN USERS
-- ============================================================
INSERT INTO public.admin_users (email, name) VALUES
  ('aniruddhvijay2k7@gmail.com', 'Aniruddh'),
  ('prachi101ed@gmail.com', 'Prachi')
ON CONFLICT (email) DO NOTHING;


-- ============================================================
-- 2. PROBLEMS
-- ============================================================
-- Insert LeetCode-style problems
INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ARRAYS & HASHING ==========

('two-sum', 'Two Sum', 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.

Constraints:
- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.', 'easy', ARRAY['array', 'hash-table'], ARRAY['A brute force approach would involve nested loops to check all pairs', 'Think about using a hash map to store numbers you''ve already seen', 'For each number, check if target - current_number exists in your hash map', 'Store both the value and its index in the hash map'], '[{"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."}, {"input": "nums = [3,2,4], target = 6", "output": "[1,2]", "explanation": "nums[1] + nums[2] = 2 + 4 = 6."}, {"input": "nums = [3,3], target = 6", "output": "[0,1]", "explanation": "The two 3s at indices 0 and 1 sum to 6."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/two-sum/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('contains-duplicate', 'Contains Duplicate', 'Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.

Constraints:
- 1 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9', 'easy', ARRAY['array', 'hash-table', 'sorting'], ARRAY['The brute force approach would check every pair of elements', 'Consider using a hash set to track elements you''ve seen', 'If you add an element that''s already in the set, you''ve found a duplicate', 'Alternative: sort the array and check adjacent elements'], '[{"input": "nums = [1,2,3,1]", "output": "true", "explanation": "The element 1 appears at indices 0 and 3."}, {"input": "nums = [1,2,3,4]", "output": "false", "explanation": "All elements are distinct."}, {"input": "nums = [1,1,1,3,3,4,3,2,4,2]", "output": "true", "explanation": "Multiple elements appear more than once."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/contains-duplicate/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('valid-anagram', 'Valid Anagram', 'Given two strings s and t, return true if t is an anagram of s, and false otherwise. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

Constraints:
- 1 <= s.length, t.length <= 5 * 10^4
- s and t consist of lowercase English letters.

Follow-up: What if the inputs contain Unicode characters? How would you adapt your solution?', 'easy', ARRAY['string', 'hash-table', 'sorting'], ARRAY['If the strings have different lengths, they cannot be anagrams', 'Count the frequency of each character in both strings', 'Compare the frequency maps to determine if they''re anagrams', 'Alternative approach: sort both strings and compare them'], '[{"input": "s = \"anagram\", t = \"nagaram\"", "output": "true", "explanation": "Both strings contain the same characters with the same frequencies."}, {"input": "s = \"rat\", t = \"car\"", "output": "false", "explanation": "The strings contain different characters."}, {"input": "s = \"listen\", t = \"silent\"", "output": "true", "explanation": "All letters match with same frequencies."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/valid-anagram/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('group-anagrams', 'Group Anagrams', 'Given an array of strings strs, group the anagrams together. You can return the answer in any order. An Anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.

Constraints:
- 1 <= strs.length <= 10^4
- 0 <= strs[i].length <= 100
- strs[i] consists of lowercase English letters.', 'medium', ARRAY['array', 'hash-table', 'string', 'sorting'], ARRAY['Anagrams will have the same characters when sorted', 'Use sorted strings as keys in a hash map', 'Alternative: use character frequency as a key (e.g., "a2b1c1")', 'Group all strings with the same key together'], '[{"input": "strs = [\"eat\",\"tea\",\"tan\",\"ate\",\"nat\",\"bat\"]", "output": "[[\"bat\"],[\"nat\",\"tan\"],[\"ate\",\"eat\",\"tea\"]]", "explanation": "There are three groups of anagrams in the input."}, {"input": "strs = [\"\"]", "output": "[[\"\"]]", "explanation": "A single empty string forms one group."}, {"input": "strs = [\"a\"]", "output": "[[\"a\"]]", "explanation": "A single character string forms one group."}]'::jsonb, 'O(n * k log k)', 'O(n * k)', 'https://leetcode.com/problems/group-anagrams/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('top-k-frequent-elements', 'Top K Frequent Elements', 'Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- k is in the range [1, the number of unique elements in the array]
- It is guaranteed that the answer is unique.

Follow-up: Your algorithm''s time complexity must be better than O(n log n), where n is the array''s size.', 'medium', ARRAY['array', 'hash-table', 'heap', 'bucket-sort', 'counting', 'quickselect'], ARRAY['First, count the frequency of each element using a hash map', 'Use bucket sort where index represents frequency for O(n) solution', 'Alternative: use a min-heap of size k', 'Bucket sort approach: create buckets where bucket[i] contains elements with frequency i'], '[{"input": "nums = [1,1,1,2,2,3], k = 2", "output": "[1,2]", "explanation": "1 appears 3 times and 2 appears 2 times, which are the two most frequent."}, {"input": "nums = [1], k = 1", "output": "[1]", "explanation": "Only one element exists."}, {"input": "nums = [4,1,-1,2,-1,2,3], k = 2", "output": "[-1,2]", "explanation": "-1 and 2 both appear twice."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/top-k-frequent-elements/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('product-of-array-except-self', 'Product of Array Except Self', 'Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i]. The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer. You must write an algorithm that runs in O(n) time and without using the division operation.

Constraints:
- 2 <= nums.length <= 10^5
- -30 <= nums[i] <= 30
- The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer.

Follow-up: Can you solve the problem in O(1) extra space complexity? (The output array does not count as extra space for space complexity analysis.)', 'medium', ARRAY['array', 'prefix-sum'], ARRAY['Think about what information you need: product of all elements to the left and all elements to the right', 'First pass: calculate prefix products (product of all elements before index i)', 'Second pass: calculate suffix products and multiply with prefix', 'You can optimize space by storing prefix in the output array, then multiplying by suffix in-place'], '[{"input": "nums = [1,2,3,4]", "output": "[24,12,8,6]", "explanation": "For index 0: 2*3*4=24, index 1: 1*3*4=12, index 2: 1*2*4=8, index 3: 1*2*3=6"}, {"input": "nums = [-1,1,0,-3,3]", "output": "[0,0,9,0,0]", "explanation": "The presence of 0 makes all products except at index 2 equal to 0."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/product-of-array-except-self/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('valid-sudoku', 'Valid Sudoku', 'Determine if a 9 x 9 Sudoku board is valid. Only the filled cells need to be validated according to the following rules:
1. Each row must contain the digits 1-9 without repetition.
2. Each column must contain the digits 1-9 without repetition.
3. Each of the nine 3 x 3 sub-boxes of the grid must contain the digits 1-9 without repetition.

Note:
- A Sudoku board (partially filled) could be valid but is not necessarily solvable.
- Only the filled cells need to be validated according to the mentioned rules.

Constraints:
- board.length == 9
- board[i].length == 9
- board[i][j] is a digit 1-9 or ''.''.', 'medium', ARRAY['array', 'hash-table', 'matrix'], ARRAY['Use hash sets to track seen digits in rows, columns, and boxes', 'For 3x3 boxes, you can compute box index as (row / 3) * 3 + (col / 3)', 'Store seen values as strings like "4 in row 0" or "4 in box 2"', 'Check all three conditions simultaneously in a single pass'], '[{"input": "board = [[\"5\",\"3\",\".\",\".\",\"7\",\".\",\".\",\".\",\".\"],[\"6\",\".\",\".\",\"1\",\"9\",\"5\",\".\",\".\",\".\"],[\".\",\"9\",\"8\",\".\",\".\",\".\",\".\",\"6\",\".\"],[\"8\",\".\",\".\",\".\",\"6\",\".\",\".\",\".\",\"3\"],[\"4\",\".\",\".\",\"8\",\".\",\"3\",\".\",\".\",\"1\"],[\"7\",\".\",\".\",\".\",\"2\",\".\",\".\",\".\",\"6\"],[\".\",\"6\",\".\",\".\",\".\",\".\",\"2\",\"8\",\".\"],[\".\",\".\",\".\",\"4\",\"1\",\"9\",\".\",\".\",\"5\"],[\".\",\".\",\".\",\".\",\"8\",\".\",\".\",\"7\",\"9\"]]", "output": "true", "explanation": "The board is valid according to Sudoku rules."}, {"input": "board = [[\"8\",\"3\",\".\",\".\",\"7\",\".\",\".\",\".\",\".\"],[\"6\",\".\",\".\",\"1\",\"9\",\"5\",\".\",\".\",\".\"],[\".\",\"9\",\"8\",\".\",\".\",\".\",\".\",\"6\",\".\"],[\"8\",\".\",\".\",\".\",\"6\",\".\",\".\",\".\",\"3\"],[\"4\",\".\",\".\",\"8\",\".\",\"3\",\".\",\".\",\"1\"],[\"7\",\".\",\".\",\".\",\"2\",\".\",\".\",\".\",\"6\"],[\".\",\"6\",\".\",\".\",\".\",\".\",\"2\",\"8\",\".\"],[\".\",\".\",\".\",\"4\",\"1\",\"9\",\".\",\".\",\"5\"],[\".\",\".\",\".\",\".\",\"8\",\".\",\".\",\"7\",\"9\"]]", "output": "false", "explanation": "The digit 8 appears twice in the first column."}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/valid-sudoku/', ARRAY['neetcode-150', 'striver-a-z']),

('longest-consecutive-sequence', 'Longest Consecutive Sequence', 'Given an unsorted array of integers nums, return the length of the longest consecutive elements sequence. You must write an algorithm that runs in O(n) time.

Constraints:
- 0 <= nums.length <= 10^5
- -10^9 <= nums[i] <= 10^9', 'medium', ARRAY['array', 'hash-table', 'union-find'], ARRAY['Use a hash set for O(1) lookups', 'Only start counting a sequence if (num - 1) is not in the set', 'This ensures you only count each sequence once from its starting point', 'For each sequence start, keep checking num+1, num+2, etc. until no longer consecutive'], '[{"input": "nums = [100,4,200,1,3,2]", "output": "4", "explanation": "The longest consecutive sequence is [1, 2, 3, 4]. Therefore its length is 4."}, {"input": "nums = [0,3,7,2,5,8,4,6,0,1]", "output": "9", "explanation": "The longest consecutive sequence is [0,1,2,3,4,5,6,7,8]."}, {"input": "nums = []", "output": "0", "explanation": "Empty array has no sequences."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/longest-consecutive-sequence/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z'])

ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    difficulty = EXCLUDED.difficulty,
    tags = EXCLUDED.tags,
    hints = EXCLUDED.hints,
    examples = EXCLUDED.examples,
    time_complexity = EXCLUDED.time_complexity,
    space_complexity = EXCLUDED.space_complexity,
    external_url = EXCLUDED.external_url,
    curated_lists = EXCLUDED.curated_lists;
