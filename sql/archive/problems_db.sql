    -- Complete rewrite of all problems with full LeetCode-quality content
-- This will update existing rows and insert new ones where needed

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
- -10^9 <= nums[i] <= 10^9', 'medium', ARRAY['array', 'hash-table', 'union-find'], ARRAY['Use a hash set for O(1) lookups', 'Only start counting a sequence if (num - 1) is not in the set', 'This ensures you only count each sequence once from its starting point', 'For each sequence start, keep checking num+1, num+2, etc. until no longer consecutive'], '[{"input": "nums = [100,4,200,1,3,2]", "output": "4", "explanation": "The longest consecutive sequence is [1, 2, 3, 4]. Therefore its length is 4."}, {"input": "nums = [0,3,7,2,5,8,4,6,0,1]", "output": "9", "explanation": "The longest consecutive sequence is [0,1,2,3,4,5,6,7,8]."}, {"input": "nums = []", "output": "0", "explanation": "Empty array has no sequences."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/longest-consecutive-sequence/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== TWO POINTERS ==========

('valid-palindrome', 'Valid Palindrome', 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Alphanumeric characters include letters and numbers. Given a string s, return true if it is a palindrome, or false otherwise.

Constraints:
- 1 <= s.length <= 2 * 10^5
- s consists only of printable ASCII characters.', 'easy', ARRAY['two-pointers', 'string'], ARRAY['Use two pointers, one at the start and one at the end', 'Skip non-alphanumeric characters by moving the pointers', 'Compare characters in a case-insensitive manner', 'Move pointers inward until they meet or cross'], '[{"input": "s = \"A man, a plan, a canal: Panama\"", "output": "true", "explanation": "After removing non-alphanumeric characters and converting to lowercase: \"amanaplanacanalpanama\" is a palindrome."}, {"input": "s = \"race a car\"", "output": "false", "explanation": "\"raceacar\" is not a palindrome."}, {"input": "s = \" \"", "output": "true", "explanation": "After removing non-alphanumeric characters, s is an empty string which reads the same forward and backward."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/valid-palindrome/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('two-sum-ii', 'Two Sum II - Input Array Is Sorted', 'Given a 1-indexed array of integers numbers that is already sorted in non-decreasing order, find two numbers such that they add up to a specific target number. Let these two numbers be numbers[index1] and numbers[index2] where 1 <= index1 < index2 <= numbers.length. Return the indices of the two numbers, index1 and index2, added by one as an integer array [index1, index2] of length 2. The tests are generated such that there is exactly one solution. You may not use the same element twice. Your solution must use only constant extra space.

Constraints:
- 2 <= numbers.length <= 3 * 10^4
- -1000 <= numbers[i] <= 1000
- numbers is sorted in non-decreasing order.
- -1000 <= target <= 1000
- The tests are generated such that there is exactly one solution.', 'medium', ARRAY['array', 'two-pointers', 'binary-search'], ARRAY['Since the array is sorted, you can use two pointers from both ends', 'If the sum is too small, move the left pointer right', 'If the sum is too large, move the right pointer left', 'This avoids the O(n^2) nested loop approach'], '[{"input": "numbers = [2,7,11,15], target = 9", "output": "[1,2]", "explanation": "The sum of 2 and 7 is 9. Since index1 = 1 and index2 = 2, return [1, 2]. Note the 1-indexed return."}, {"input": "numbers = [2,3,4], target = 6", "output": "[1,3]", "explanation": "2 + 4 = 6, indices are 1 and 3."}, {"input": "numbers = [-1,0], target = -1", "output": "[1,2]", "explanation": "-1 + 0 = -1."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', ARRAY['neetcode-150', 'striver-a-z']),

('3sum', '3Sum', 'Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0. Notice that the solution set must not contain duplicate triplets.

Constraints:
- 3 <= nums.length <= 3000
- -10^5 <= nums[i] <= 10^5', 'medium', ARRAY['array', 'two-pointers', 'sorting'], ARRAY['Sort the array first to enable two-pointer technique and handle duplicates', 'Fix one number and use two pointers on the remaining array (like Two Sum II)', 'Skip duplicate values for all three positions to avoid duplicate triplets', 'For the fixed number, if it''s positive and we''re looking for sum = 0, we can break early'], '[{"input": "nums = [-1,0,1,2,-1,-4]", "output": "[[-1,-1,2],[-1,0,1]]", "explanation": "The distinct triplets are [-1,0,1] and [-1,-1,2]. Notice that the order of output and the order of triplets does not matter."}, {"input": "nums = [0,1,1]", "output": "[]", "explanation": "The only possible triplet does not sum up to 0."}, {"input": "nums = [0,0,0]", "output": "[[0,0,0]]", "explanation": "The only possible triplet sums up to 0."}]'::jsonb, 'O(n^2)', 'O(1)', 'https://leetcode.com/problems/3sum/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('container-with-most-water', 'Container With Most Water', 'You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store. Notice that you may not slant the container.

Constraints:
- n == height.length
- 2 <= n <= 10^5
- 0 <= height[i] <= 10^4', 'medium', ARRAY['array', 'two-pointers', 'greedy'], ARRAY['Start with the widest container (pointers at both ends)', 'The area is limited by the shorter line', 'Move the pointer pointing to the shorter line inward', 'This greedy approach ensures we don''t miss the maximum area'], '[{"input": "height = [1,8,6,2,5,4,8,3,7]", "output": "49", "explanation": "The vertical lines at indices 1 and 8 have heights 8 and 7. The area between them is min(8,7) * (8-1) = 7 * 7 = 49."}, {"input": "height = [1,1]", "output": "1", "explanation": "The only container has area 1 * 1 = 1."}, {"input": "height = [4,3,2,1,4]", "output": "16", "explanation": "The lines at indices 0 and 4 both have height 4, giving area 4 * 4 = 16."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/container-with-most-water/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('trapping-rain-water', 'Trapping Rain Water', 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.

Constraints:
- n == height.length
- 1 <= n <= 2 * 10^4
- 0 <= height[i] <= 10^5', 'hard', ARRAY['array', 'two-pointers', 'dynamic-programming', 'stack', 'monotonic-stack'], ARRAY['Water trapped at position i = min(max_left, max_right) - height[i]', 'You can use two pointers moving from both ends', 'Track left_max and right_max as you move pointers inward', 'Add water only when you''re at the shorter side (guaranteed to trap water)'], '[{"input": "height = [0,1,0,2,1,0,1,3,2,1,2,1]", "output": "6", "explanation": "The elevation map traps 6 units of rain water."}, {"input": "height = [4,2,0,3,2,5]", "output": "9", "explanation": "Water is trapped in the dips between the peaks."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/trapping-rain-water/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', 'You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.

Constraints:
- 1 <= prices.length <= 10^5
- 0 <= prices[i] <= 10^4', 'easy', ARRAY['array', 'dynamic-programming'], ARRAY['Track the minimum price seen so far as you iterate', 'At each position, calculate profit if you sold at current price', 'Keep track of the maximum profit encountered', 'This is essentially finding max(prices[j] - prices[i]) where j > i'], '[{"input": "prices = [7,1,5,3,6,4]", "output": "5", "explanation": "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6-1 = 5. Note that buying on day 2 and selling on day 1 is not allowed because you must buy before you sell."}, {"input": "prices = [7,6,4,3,1]", "output": "0", "explanation": "In this case, no transactions are done and the max profit = 0."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/best-time-to-buy-and-sell-stock/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-substring-without-repeating-characters', 'Longest Substring Without Repeating Characters', 'Given a string s, find the length of the longest substring without repeating characters.

Constraints:
- 0 <= s.length <= 5 * 10^4
- s consists of English letters, digits, symbols and spaces.', 'medium', ARRAY['hash-table', 'string', 'sliding-window'], ARRAY['Use a sliding window approach with two pointers', 'Use a hash map to store the last seen index of each character', 'When you find a duplicate, move the left pointer to skip the duplicate', 'Update the maximum length at each step'], '[{"input": "s = \"abcabcbb\"", "output": "3", "explanation": "The answer is \"abc\", with the length of 3."}, {"input": "s = \"bbbbb\"", "output": "1", "explanation": "The answer is \"b\", with the length of 1."}, {"input": "s = \"pwwkew\"", "output": "3", "explanation": "The answer is \"wke\", with the length of 3. Notice that the answer must be a substring, \"pwke\" is a subsequence and not a substring."}]'::jsonb, 'O(n)', 'O(min(m, n))', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-repeating-character-replacement', 'Longest Repeating Character Replacement', 'You are given a string s and an integer k. You can choose any character of the string and change it to any other uppercase English character. You can perform this operation at most k times. Return the length of the longest substring containing the same letter you can get after performing the above operations.

Constraints:
- 1 <= s.length <= 10^5
- s consists of only uppercase English letters.
- 0 <= k <= s.length', 'medium', ARRAY['hash-table', 'string', 'sliding-window'], ARRAY['Use a sliding window with character frequency map', 'Window is valid if (window_size - max_frequency) <= k', 'The max_frequency is the count of the most frequent character in current window', 'Expand window by adding characters, shrink when invalid'], '[{"input": "s = \"ABAB\", k = 2", "output": "4", "explanation": "Replace the two ''A''s with two ''B''s or vice versa to get \"AAAA\" or \"BBBB\"."}, {"input": "s = \"AABABBA\", k = 1", "output": "4", "explanation": "Replace one ''A'' in the middle with ''B'' and form \"AABBBBA\". The substring \"BBBB\" has the longest repeating letters, which is 4."}]'::jsonb, 'O(n)', 'O(26)', 'https://leetcode.com/problems/longest-repeating-character-replacement/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('permutation-in-string', 'Permutation in String', 'Given two strings s1 and s2, return true if s2 contains a permutation of s1, or false otherwise. In other words, return true if one of s1''s permutations is the substring of s2.

Constraints:
- 1 <= s1.length, s2.length <= 10^4
- s1 and s2 consist of lowercase English letters.', 'medium', ARRAY['hash-table', 'two-pointers', 'string', 'sliding-window'], ARRAY['Use a sliding window of size s1.length', 'Compare character frequencies in the window with s1''s frequencies', 'Slide the window one character at a time', 'Use an array of size 26 for efficient frequency comparison'], '[{"input": "s1 = \"ab\", s2 = \"eidbaooo\"", "output": "true", "explanation": "s2 contains one permutation of s1 (\"ba\")."}, {"input": "s1 = \"ab\", s2 = \"eidboaoo\"", "output": "false", "explanation": "No permutation of s1 exists in s2."}]'::jsonb, 'O(n)', 'O(26)', 'https://leetcode.com/problems/permutation-in-string/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== STACK ==========

('valid-parentheses', 'Valid Parentheses', 'Given a string s containing just the characters ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid. An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

Constraints:
- 1 <= s.length <= 10^4
- s consists of parentheses only ''()[]{}''', 'easy', ARRAY['string', 'stack'], ARRAY['Use a stack to keep track of opening brackets', 'When you encounter a closing bracket, check if it matches the top of the stack', 'Push opening brackets onto the stack', 'At the end, the stack should be empty for a valid string'], '[{"input": "s = \"()\"", "output": "true", "explanation": "The string contains valid pairs of parentheses."}, {"input": "s = \"()[]{}\"", "output": "true", "explanation": "All brackets are properly matched and closed in order."}, {"input": "s = \"(]\"", "output": "false", "explanation": "The brackets are not of the same type."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/valid-parentheses/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('min-stack', 'Min Stack', 'Design a stack that supports push, pop, top, and retrieving the minimum element in constant time. Implement the MinStack class:
- MinStack() initializes the stack object.
- void push(int val) pushes the element val onto the stack.
- void pop() removes the element on the top of the stack.
- int top() gets the top element of the stack.
- int getMin() retrieves the minimum element in the stack.

You must implement a solution with O(1) time complexity for each function.

Constraints:
- -2^31 <= val <= 2^31 - 1
- Methods pop, top and getMin operations will always be called on non-empty stacks.
- At most 3 * 10^4 calls will be made to push, pop, top, and getMin.', 'medium', ARRAY['stack', 'design'], ARRAY['Use two stacks: one for values and one for minimums', 'When pushing, also push the current minimum onto the min stack', 'When popping, pop from both stacks', 'The top of the min stack always contains the current minimum'], '[{"input": "[\"MinStack\",\"push\",\"push\",\"push\",\"getMin\",\"pop\",\"top\",\"getMin\"][[],[-2],[0],[-3],[],[],[],[]]", "output": "[null,null,null,null,-3,null,0,-2]", "explanation": "MinStack minStack = new MinStack(); minStack.push(-2); minStack.push(0); minStack.push(-3); minStack.getMin(); // return -3; minStack.pop(); minStack.top(); // return 0; minStack.getMin(); // return -2"}]'::jsonb, 'O(1)', 'O(n)', 'https://leetcode.com/problems/min-stack/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('evaluate-reverse-polish-notation', 'Evaluate Reverse Polish Notation', 'You are given an array of strings tokens that represents an arithmetic expression in a Reverse Polish Notation. Evaluate the expression. Return an integer that represents the value of the expression. Note that:
- The valid operators are ''+'', ''-'', ''*'', and ''/''.
- Each operand may be an integer or another expression.
- The division between two integers always truncates toward zero.
- There will not be any division by zero.
- The input represents a valid arithmetic expression in reverse polish notation.
- The answer and all intermediate calculations can be represented in a 32-bit integer.

Constraints:
- 1 <= tokens.length <= 10^4
- tokens[i] is either an operator: "+", "-", "*", or "/", or an integer in the range [-200, 200].', 'medium', ARRAY['array', 'math', 'stack'], ARRAY['Use a stack to process the tokens', 'Push numbers onto the stack', 'When you encounter an operator, pop two numbers, apply the operation, and push the result', 'The final answer is the only element left in the stack'], '[{"input": "tokens = [\"2\",\"1\",\"+\",\"3\",\"*\"]", "output": "9", "explanation": "((2 + 1) * 3) = 9"}, {"input": "tokens = [\"4\",\"13\",\"5\",\"/\",\"+\"]", "output": "6", "explanation": "(4 + (13 / 5)) = 6"}, {"input": "tokens = [\"10\",\"6\",\"9\",\"3\",\"+\",\"-11\",\"*\",\"/\",\"*\",\"17\",\"+\",\"5\",\"+\"]", "output": "22", "explanation": "((10 * (6 / ((9 + 3) * -11))) + 17) + 5 = 22"}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/evaluate-reverse-polish-notation/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('generate-parentheses', 'Generate Parentheses', 'Given n pairs of parentheses, write a function to generate all combinations of well-formed parentheses.

Constraints:
- 1 <= n <= 8', 'medium', ARRAY['string', 'dynamic-programming', 'backtracking'], ARRAY['Use backtracking to build valid strings', 'Only add an opening bracket if you haven''t used all n of them', 'Only add a closing bracket if it wouldn''t exceed the number of opening brackets', 'Track counts of opening and closing brackets used'], '[{"input": "n = 3", "output": "[\"((()))\",\"(()())\",\"(())()\",\"()(())\",\"()()()\"]", "explanation": "All possible combinations of 3 pairs of well-formed parentheses."}, {"input": "n = 1", "output": "[\"()\"]", "explanation": "Only one valid combination exists."}]'::jsonb, 'O(4^n / sqrt(n))', 'O(n)', 'https://leetcode.com/problems/generate-parentheses/', ARRAY['neetcode-150', 'striver-a-z']),

('daily-temperatures', 'Daily Temperatures', 'Given an array of integers temperatures represents the daily temperatures, return an array answer such that answer[i] is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day for which this is possible, keep answer[i] == 0 instead.

Constraints:
- 1 <= temperatures.length <= 10^5
- 30 <= temperatures[i] <= 100', 'medium', ARRAY['array', 'stack', 'monotonic-stack'], ARRAY['Use a monotonic decreasing stack to store indices', 'When current temperature is warmer than stack top, pop and calculate days', 'The stack helps you find the next warmer day efficiently', 'Always push current index onto stack after processing'], '[{"input": "temperatures = [73,74,75,71,69,72,76,73]", "output": "[1,1,4,2,1,1,0,0]", "explanation": "For day 0 (73°), the next warmer day is day 1 (74°), so answer[0] = 1. For day 1 (74°), the next warmer day is day 2 (75°), so answer[1] = 1."}, {"input": "temperatures = [30,40,50,60]", "output": "[1,1,1,0]", "explanation": "Each day has the next day warmer except the last."}, {"input": "temperatures = [30,60,90]", "output": "[1,1,0]", "explanation": "Days 0 and 1 have next warmer days, but day 2 does not."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/daily-temperatures/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== LINKED LIST ==========

('reverse-linked-list', 'Reverse Linked List', 'Given the head of a singly linked list, reverse the list, and return the reversed list.

Constraints:
- The number of nodes in the list is the range [0, 5000].
- -5000 <= Node.val <= 5000

Follow-up: A linked list can be reversed either iteratively or recursively. Could you implement both?', 'easy', ARRAY['linked-list', 'recursion'], ARRAY['Iterative: Use three pointers (prev, curr, next)', 'Keep track of the previous node as you move forward', 'Reverse the link by setting curr.next = prev', 'Recursive: Reverse the rest of the list first, then fix current node'], '[{"input": "head = [1,2,3,4,5]", "output": "[5,4,3,2,1]", "explanation": "The list is reversed so 5 becomes the new head."}, {"input": "head = [1,2]", "output": "[2,1]", "explanation": "A simple two-node list reversed."}, {"input": "head = []", "output": "[]", "explanation": "Empty list remains empty."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/reverse-linked-list/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('merge-two-sorted-lists', 'Merge Two Sorted Lists', 'You are given the heads of two sorted linked lists list1 and list2. Merge the two lists into one sorted list. The list should be made by splicing together the nodes of the first two lists. Return the head of the merged linked list.

Constraints:
- The number of nodes in both lists is in the range [0, 50].
- -100 <= Node.val <= 100
- Both list1 and list2 are sorted in non-decreasing order.', 'easy', ARRAY['linked-list', 'recursion'], ARRAY['Use a dummy node to simplify edge cases', 'Compare heads of both lists and attach the smaller one', 'Advance the pointer of the list whose node was added', 'Continue until one list is exhausted, then attach the remainder'], '[{"input": "list1 = [1,2,4], list2 = [1,3,4]", "output": "[1,1,2,3,4,4]", "explanation": "Merging the two sorted lists results in a sorted merged list."}, {"input": "list1 = [], list2 = []", "output": "[]", "explanation": "Both lists are empty."}, {"input": "list1 = [], list2 = [0]", "output": "[0]", "explanation": "Only one list has elements."}]'::jsonb, 'O(n + m)', 'O(1)', 'https://leetcode.com/problems/merge-two-sorted-lists/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('reorder-list', 'Reorder List', 'You are given the head of a singly linked-list. The list can be represented as: L0 → L1 → ... → Ln-1 → Ln. Reorder the list to be on the following form: L0 → Ln → L1 → Ln-1 → L2 → Ln-2 → ... You may not modify the values in the list''s nodes. Only nodes themselves may be changed.

Constraints:
- The number of nodes in the list is in the range [1, 5 * 10^4].
- 1 <= Node.val <= 1000', 'medium', ARRAY['linked-list', 'two-pointers', 'stack', 'recursion'], ARRAY['Find the middle of the list using slow/fast pointers', 'Reverse the second half of the list', 'Merge the first half and reversed second half alternately', 'Be careful with odd/even length lists'], '[{"input": "head = [1,2,3,4]", "output": "[1,4,2,3]", "explanation": "The list is reordered as L0 → L3 → L1 → L2."}, {"input": "head = [1,2,3,4,5]", "output": "[1,5,2,4,3]", "explanation": "For odd length, the middle stays and alternation happens around it."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/reorder-list/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('linked-list-cycle', 'Linked List Cycle', 'Given head, the head of a linked list, determine if the linked list has a cycle in it. There is a cycle in a linked list if there is some node in the list that can be reached again by continuously following the next pointer. Internally, pos is used to denote the index of the node that tail''s next pointer is connected to. Note that pos is not passed as a parameter. Return true if there is a cycle in the linked list. Otherwise, return false.

Constraints:
- The number of the nodes in the list is in the range [0, 10^4].
- -10^5 <= Node.val <= 10^5
- pos is -1 or a valid index in the linked-list.

Follow-up: Can you solve it using O(1) (i.e. constant) memory?', 'easy', ARRAY['hash-table', 'linked-list', 'two-pointers'], ARRAY['Use Floyd''s Cycle Detection Algorithm (slow and fast pointers)', 'Move slow pointer one step and fast pointer two steps', 'If they meet, there''s a cycle', 'If fast reaches null, there''s no cycle'], '[{"input": "head = [3,2,0,-4], pos = 1", "output": "true", "explanation": "There is a cycle in the linked list, where the tail connects to the 1st node (0-indexed)."}, {"input": "head = [1,2], pos = 0", "output": "true", "explanation": "There is a cycle where tail connects to the 0th node."}, {"input": "head = [1], pos = -1", "output": "false", "explanation": "There is no cycle in the linked list."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/linked-list-cycle/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('remove-nth-node-from-end-of-list', 'Remove Nth Node From End of List', 'Given the head of a linked list, remove the nth node from the end of the list and return its head.

Constraints:
- The number of nodes in the list is sz.
- 1 <= sz <= 30
- 0 <= Node.val <= 100
- 1 <= n <= sz

Follow-up: Could you do this in one pass?', 'medium', ARRAY['linked-list', 'two-pointers'], ARRAY['Use two pointers with a gap of n nodes between them', 'Move both pointers until the fast one reaches the end', 'The slow pointer will be just before the node to remove', 'Use a dummy node to handle edge cases like removing the head'], '[{"input": "head = [1,2,3,4,5], n = 2", "output": "[1,2,3,5]", "explanation": "The 2nd node from the end (node with value 4) is removed."}, {"input": "head = [1], n = 1", "output": "[]", "explanation": "The only node is removed, resulting in an empty list."}, {"input": "head = [1,2], n = 1", "output": "[1]", "explanation": "The last node is removed."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/remove-nth-node-from-end-of-list/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BINARY TREE ==========

('invert-binary-tree', 'Invert Binary Tree', 'Given the root of a binary tree, invert the tree, and return its root.

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100', 'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Recursively swap the left and right children of every node', 'Can be done with DFS (preorder, postorder) or BFS', 'Base case: if node is null, return null', 'Invert left and right subtrees, then swap them'], '[{"input": "root = [4,2,7,1,3,6,9]", "output": "[4,7,2,9,6,3,1]", "explanation": "The tree is inverted at every level."}, {"input": "root = [2,1,3]", "output": "[2,3,1]", "explanation": "Simple tree with one level of children inverted."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree remains empty."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/invert-binary-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('maximum-depth-of-binary-tree', 'Maximum Depth of Binary Tree', 'Given the root of a binary tree, return its maximum depth. A binary tree''s maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.

Constraints:
- The number of nodes in the tree is in the range [0, 10^4].
- -100 <= Node.val <= 100', 'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Recursively calculate depth of left and right subtrees', 'The depth of current node is 1 + max(left_depth, right_depth)', 'Base case: depth of null node is 0', 'Can also use BFS and count levels'], '[{"input": "root = [3,9,20,null,null,15,7]", "output": "3", "explanation": "The maximum depth is 3 (path: 3 -> 20 -> 7 or 3 -> 20 -> 15)."}, {"input": "root = [1,null,2]", "output": "2", "explanation": "The path 1 -> 2 has length 2."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/maximum-depth-of-binary-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('diameter-of-binary-tree', 'Diameter of Binary Tree', 'Given the root of a binary tree, return the length of the diameter of the tree. The diameter of a binary tree is the length of the longest path between any two nodes in a tree. This path may or may not pass through the root. The length of a path between two nodes is represented by the number of edges between them.

Constraints:
- The number of nodes in the tree is in the range [1, 10^4].
- -100 <= Node.val <= 100', 'easy', ARRAY['tree', 'depth-first-search', 'binary-tree'], ARRAY['The diameter at any node is left_height + right_height', 'Recursively calculate height of left and right subtrees', 'Track the maximum diameter seen during the traversal', 'The height returned to parent is 1 + max(left, right)'], '[{"input": "root = [1,2,3,4,5]", "output": "3", "explanation": "The diameter is the path [4,2,1,3] or [5,2,1,3] with length 3."}, {"input": "root = [1,2]", "output": "1", "explanation": "The only path has length 1."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/diameter-of-binary-tree/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('balanced-binary-tree', 'Balanced Binary Tree', 'Given a binary tree, determine if it is height-balanced. A height-balanced binary tree is a binary tree in which the depth of the two subtrees of every node never differs by more than one.

Constraints:
- The number of nodes in the tree is in the range [0, 5000].
- -10^4 <= Node.val <= 10^4', 'easy', ARRAY['tree', 'depth-first-search', 'binary-tree'], ARRAY['Check balance condition at every node recursively', 'A tree is balanced if: |left_height - right_height| <= 1', 'Return -1 from recursion to signal imbalance early', 'Both left and right subtrees must also be balanced'], '[{"input": "root = [3,9,20,null,null,15,7]", "output": "true", "explanation": "The tree is balanced with max height difference of 1."}, {"input": "root = [1,2,2,3,3,null,null,4,4]", "output": "false", "explanation": "The left subtree has height 3 while right has height 1."}, {"input": "root = []", "output": "true", "explanation": "Empty tree is considered balanced."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/balanced-binary-tree/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('same-tree', 'Same Tree', 'Given the roots of two binary trees p and q, write a function to check if they are the same or not. Two binary trees are considered the same if they are structurally identical, and the nodes have the same value.

Constraints:
- The number of nodes in both trees is in the range [0, 100].
- -10^4 <= Node.val <= 10^4', 'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Both trees must have the same structure and values at each position', 'Base cases: both null → true, one null → false', 'Check if current values match, then recurse on left and right', 'Can use DFS or BFS approach'], '[{"input": "p = [1,2,3], q = [1,2,3]", "output": "true", "explanation": "Both trees have identical structure and values."}, {"input": "p = [1,2], q = [1,null,2]", "output": "false", "explanation": "The structure is different (left child vs right child)."}, {"input": "p = [1,2,1], q = [1,1,2]", "output": "false", "explanation": "The values at corresponding positions differ."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/same-tree/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('subtree-of-another-tree', 'Subtree of Another Tree', 'Given the roots of two binary trees root and subRoot, return true if there is a subtree of root with the same structure and node values of subRoot and false otherwise. A subtree of a binary tree tree is a tree that consists of a node in tree and all of this node''s descendants. The tree tree could also be considered as a subtree of itself.

Constraints:
- The number of nodes in the root tree is in the range [1, 2000].
- The number of nodes in the subRoot tree is in the range [1, 1000].
- -10^4 <= root.val <= 10^4
- -10^4 <= subRoot.val <= 10^4', 'easy', ARRAY['tree', 'depth-first-search', 'string-matching', 'hash-function', 'binary-tree'], ARRAY['For each node in root, check if subtree starting there matches subRoot', 'Use the "Same Tree" logic as a helper function', 'Traverse root tree and test at each node', 'Short-circuit: if found match, return true immediately'], '[{"input": "root = [3,4,5,1,2], subRoot = [4,1,2]", "output": "true", "explanation": "The subtree rooted at node 4 matches subRoot."}, {"input": "root = [3,4,5,1,2,null,null,null,null,0], subRoot = [4,1,2]", "output": "false", "explanation": "The subtree rooted at 4 has an extra node (0) that subRoot doesn''t have."}]'::jsonb, 'O(m * n)', 'O(h)', 'https://leetcode.com/problems/subtree-of-another-tree/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('lowest-common-ancestor-of-a-binary-search-tree', 'Lowest Common Ancestor of a Binary Search Tree', 'Given a binary search tree (BST), find the lowest common ancestor (LCA) node of two given nodes in the BST. According to the definition of LCA on Wikipedia: "The lowest common ancestor is defined between two nodes p and q as the lowest node in T that has both p and q as descendants (where we allow a node to be a descendant of itself)."

Constraints:
- The number of nodes in the tree is in the range [2, 10^5].
- -10^9 <= Node.val <= 10^9
- All Node.val are unique.
- p != q
- p and q will exist in the BST.', 'medium', ARRAY['tree', 'depth-first-search', 'binary-search-tree', 'binary-tree'], ARRAY['Use BST property: left < root < right', 'If both p and q are smaller than root, LCA is in left subtree', 'If both are larger, LCA is in right subtree', 'Otherwise, current node is the LCA'], '[{"input": "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 8", "output": "6", "explanation": "The LCA of nodes 2 and 8 is 6."}, {"input": "root = [6,2,8,0,4,7,9,null,null,3,5], p = 2, q = 4", "output": "2", "explanation": "The LCA of nodes 2 and 4 is 2, since a node can be a descendant of itself."}, {"input": "root = [2,1], p = 2, q = 1", "output": "2", "explanation": "The LCA is the root itself."}]'::jsonb, 'O(h)', 'O(h)', 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BINARY SEARCH ==========

('binary-search', 'Binary Search', 'Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 < nums[i], target < 10^4
- All the integers in nums are unique.
- nums is sorted in ascending order.', 'easy', ARRAY['array', 'binary-search'], ARRAY['Use two pointers: left and right', 'Calculate mid = left + (right - left) / 2', 'If nums[mid] == target, return mid', 'If nums[mid] < target, search right half, else search left half'], '[{"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4", "explanation": "9 exists in nums and its index is 4."}, {"input": "nums = [-1,0,3,5,9,12], target = 2", "output": "-1", "explanation": "2 does not exist in nums so return -1."}]'::jsonb, 'O(log n)', 'O(1)', 'https://leetcode.com/problems/binary-search/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('search-a-2d-matrix', 'Search a 2D Matrix', 'You are given an m x n integer matrix matrix with the following two properties:
- Each row is sorted in non-decreasing order.
- The first integer of each row is greater than the last integer of the previous row.
Given an integer target, return true if target is in matrix or false otherwise. You must write a solution in O(log(m * n)) time complexity.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 100
- -10^4 <= matrix[i][j], target <= 10^4', 'medium', ARRAY['array', 'binary-search', 'matrix'], ARRAY['Treat the 2D matrix as a flattened 1D sorted array', 'Use binary search on the virtual 1D array', 'Convert 1D index to 2D: row = idx / cols, col = idx % cols', 'Total elements = m * n, so search range is [0, m*n-1]'], '[{"input": "matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 3", "output": "true", "explanation": "3 is found at position (0, 1)."}, {"input": "matrix = [[1,3,5,7],[10,11,16,20],[23,30,34,60]], target = 13", "output": "false", "explanation": "13 does not exist in the matrix."}]'::jsonb, 'O(log(m * n))', 'O(1)', 'https://leetcode.com/problems/search-a-2d-matrix/', ARRAY['neetcode-150', 'striver-a-z']),

('koko-eating-bananas', 'Koko Eating Bananas', 'Koko loves to eat bananas. There are n piles of bananas, the ith pile has piles[i] bananas. The guards have gone and will come back in h hours. Koko can decide her bananas-per-hour eating speed of k. Each hour, she chooses some pile of bananas and eats k bananas from that pile. If the pile has less than k bananas, she eats all of them instead and will not eat any more bananas during this hour. Koko likes to eat slowly but still wants to finish eating all the bananas before the guards return. Return the minimum integer k such that she can eat all the bananas within h hours.

Constraints:
- 1 <= piles.length <= 10^4
- piles.length <= h <= 10^9
- 1 <= piles[i] <= 10^9', 'medium', ARRAY['array', 'binary-search'], ARRAY['Binary search on the answer (eating speed k)', 'Search range: 1 to max(piles)', 'For each mid value, calculate hours needed with that speed', 'If hours needed <= h, try smaller speed; else try larger'], '[{"input": "piles = [3,6,7,11], h = 8", "output": "4", "explanation": "Koko can eat at speed 4: pile 3 takes 1 hour, pile 6 takes 2 hours, pile 7 takes 2 hours, pile 11 takes 3 hours. Total = 8 hours."}, {"input": "piles = [30,11,23,4,20], h = 5", "output": "30", "explanation": "Koko must eat at speed 30 to finish in exactly 5 hours."}, {"input": "piles = [30,11,23,4,20], h = 6", "output": "23", "explanation": "With 6 hours available, speed 23 is sufficient."}]'::jsonb, 'O(n * log(max(piles)))', 'O(1)', 'https://leetcode.com/problems/koko-eating-bananas/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== HEAP / PRIORITY QUEUE ==========

('kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'Design a class to find the kth largest element in a stream. Note that it is the kth largest element in the sorted order, not the kth distinct element. Implement KthLargest class:
- KthLargest(int k, int[] nums) Initializes the object with the integer k and the stream of integers nums.
- int add(int val) Appends the integer val to the stream and returns the element representing the kth largest element in the stream.

Constraints:
- 1 <= k <= 10^4
- 0 <= nums.length <= 10^4
- -10^4 <= nums[i] <= 10^4
- -10^4 <= val <= 10^4
- At most 10^4 calls will be made to add.
- It is guaranteed that there will be at least k elements in the array when you search for the kth element.', 'easy', ARRAY['tree', 'design', 'binary-tree', 'heap', 'binary-search-tree', 'data-stream'], ARRAY['Use a min-heap of size k', 'The root of the min-heap is always the kth largest element', 'When adding elements, maintain heap size at k', 'If new element > heap top, remove top and add new element'], '[{"input": "[\"KthLargest\", \"add\", \"add\", \"add\", \"add\", \"add\"][[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]]", "output": "[null, 4, 5, 5, 8, 8]", "explanation": "KthLargest kthLargest = new KthLargest(3, [4, 5, 8, 2]); kthLargest.add(3); // return 4; kthLargest.add(5); // return 5; kthLargest.add(10); // return 5; kthLargest.add(9); // return 8; kthLargest.add(4); // return 8"}]'::jsonb, 'O(log k)', 'O(k)', 'https://leetcode.com/problems/kth-largest-element-in-a-stream/', ARRAY['neetcode-150', 'striver-a-z']),

('last-stone-weight', 'Last Stone Weight', 'You are given an array of integers stones where stones[i] is the weight of the ith stone. We are playing a game with the stones. On each turn, we choose the heaviest two stones and smash them together. Suppose the heaviest two stones have weights x and y with x <= y. The result of this smash is:
- If x == y, both stones are destroyed, and
- If x != y, the stone of weight x is destroyed, and the stone of weight y has new weight y - x.
At the end of the game, there is at most one stone left. Return the weight of the last remaining stone. If there are no stones left, return 0.

Constraints:
- 1 <= stones.length <= 30
- 1 <= stones[i] <= 1000', 'easy', ARRAY['array', 'heap'], ARRAY['Use a max-heap to always get the two heaviest stones', 'Pop two stones, calculate difference', 'If difference > 0, push it back to heap', 'Continue until 0 or 1 stone remains'], '[{"input": "stones = [2,7,4,1,8,1]", "output": "1", "explanation": "Combine 7 and 8 → 1. Then combine 4 and 1 → 3. Then 2 and 1 → 1. Then 3 and 1 → 2. Finally 2 and 1 → 1."}, {"input": "stones = [1]", "output": "1", "explanation": "Only one stone, so it remains."}]'::jsonb, 'O(n log n)', 'O(n)', 'https://leetcode.com/problems/last-stone-weight/', ARRAY['neetcode-150', 'striver-a-z']),

('k-closest-points-to-origin', 'K Closest Points to Origin', 'Given an array of points where points[i] = [xi, yi] represents a point on the X-Y plane and an integer k, return the k closest points to the origin (0, 0). The distance between two points on the X-Y plane is the Euclidean distance (i.e., √(x1 - x2)² + (y1 - y2)²). You may return the answer in any order. The answer is guaranteed to be unique (except for the order that it is in).

Constraints:
- 1 <= k <= points.length <= 10^4
- -10^4 < xi, yi < 10^4', 'medium', ARRAY['array', 'math', 'divide-and-conquer', 'geometry', 'sorting', 'heap', 'quickselect'], ARRAY['Use a max-heap of size k to track k closest points', 'Distance comparison doesn''t need square root (compare x²+y² directly)', 'Alternative: use QuickSelect for O(n) average time', 'Max-heap ensures we keep the k smallest distances'], '[{"input": "points = [[1,3],[-2,2]], k = 1", "output": "[[-2,2]]", "explanation": "Distance from origin: (1,3) = √10, (-2,2) = √8. The closest is (-2,2)."}, {"input": "points = [[3,3],[5,-1],[-2,4]], k = 2", "output": "[[3,3],[-2,4]]", "explanation": "The two closest points are (3,3) with distance √18 and (-2,4) with distance √20."}]'::jsonb, 'O(n log k)', 'O(k)', 'https://leetcode.com/problems/k-closest-points-to-origin/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z'])

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



-- Continuation: Binary Tree (Advanced/BFS), Trie, Backtracking, and Graphs

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== BINARY TREE (Advanced/BFS) ==========

('binary-tree-level-order-traversal', 'Binary Tree Level Order Traversal', 'Given the root of a binary tree, return the level order traversal of its nodes'' values. (i.e., from left to right, level by level).

Constraints:
- The number of nodes in the tree is in the range [0, 2000].
- -1000 <= Node.val <= 1000', 'medium', ARRAY['tree', 'breadth-first-search', 'binary-tree'], ARRAY['Use a queue for BFS traversal', 'Process nodes level by level by tracking queue size', 'For each level, dequeue all nodes at current level before moving to next', 'Add children of dequeued nodes to the queue for next level'], '[{"input": "root = [3,9,20,null,null,15,7]", "output": "[[3],[9,20],[15,7]]", "explanation": "Level 0: [3], Level 1: [9,20], Level 2: [15,7]."}, {"input": "root = [1]", "output": "[[1]]", "explanation": "Single node at level 0."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree has no levels."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-level-order-traversal/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('binary-tree-right-side-view', 'Binary Tree Right Side View', 'Given the root of a binary tree, imagine yourself standing on the right side of it, return the values of the nodes you can see ordered from top to bottom.

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100', 'medium', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Use level-order traversal (BFS)', 'For each level, only add the last (rightmost) node to result', 'Alternative: use DFS and track depth, adding first node seen at each depth', 'BFS approach: the last node processed at each level is the rightmost'], '[{"input": "root = [1,2,3,null,5,null,4]", "output": "[1,3,4]", "explanation": "From right side: see 1 (root), then 3 (rightmost of level 1), then 4 (rightmost of level 2)."}, {"input": "root = [1,null,3]", "output": "[1,3]", "explanation": "Only right children are visible."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree has no visible nodes."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-right-side-view/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('validate-binary-search-tree', 'Validate Binary Search Tree', 'Given the root of a binary tree, determine if it is a valid binary search tree (BST). A valid BST is defined as follows:
- The left subtree of a node contains only nodes with keys less than the node''s key.
- The right subtree of a node contains only nodes with keys greater than the node''s key.
- Both the left and right subtrees must also be binary search trees.

Constraints:
- The number of nodes in the tree is in the range [1, 10^4].
- -2^31 <= Node.val <= 2^31 - 1', 'medium', ARRAY['tree', 'depth-first-search', 'binary-search-tree', 'binary-tree'], ARRAY['Pass down valid range (min, max) for each node during recursion', 'Root can be any value, left children must be < root, right > root', 'Alternative: perform inorder traversal and check if values are strictly increasing', 'Be careful with integer overflow for min/max boundaries'], '[{"input": "root = [2,1,3]", "output": "true", "explanation": "This is a valid BST with 1 < 2 < 3."}, {"input": "root = [5,1,4,null,null,3,6]", "output": "false", "explanation": "The root node''s value is 5 but its right child''s value is 4, and right subtree contains 3 which is less than 5."}, {"input": "root = [2,2,2]", "output": "false", "explanation": "BST requires strictly less/greater, not equal values."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/validate-binary-search-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('kth-smallest-element-in-a-bst', 'Kth Smallest Element in a BST', 'Given the root of a binary search tree, and an integer k, return the kth smallest value (1-indexed) of all the values of the nodes in the tree.

Constraints:
- The number of nodes in the tree is n.
- 1 <= k <= n <= 10^4
- 0 <= Node.val <= 10^4

Follow-up: If the BST is modified often (i.e., we can do insert and delete operations) and you need to find the kth smallest frequently, how would you optimize?', 'medium', ARRAY['tree', 'depth-first-search', 'binary-search-tree', 'binary-tree'], ARRAY['Inorder traversal of BST yields values in ascending order', 'Perform inorder and return the kth element', 'Can optimize by stopping early once k elements are visited', 'Follow-up: augment tree nodes with subtree size for O(h) queries'], '[{"input": "root = [3,1,4,null,2], k = 1", "output": "1", "explanation": "Inorder: [1, 2, 3, 4], the 1st smallest is 1."}, {"input": "root = [5,3,6,2,4,null,null,1], k = 3", "output": "3", "explanation": "Inorder: [1, 2, 3, 4, 5, 6], the 3rd smallest is 3."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/kth-smallest-element-in-a-bst/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== TRIE (Prefix Tree) ==========

('implement-trie-prefix-tree', 'Implement Trie (Prefix Tree)', 'A trie (pronounced as "try") or prefix tree is a tree data structure used to efficiently store and retrieve keys in a dataset of strings. There are various applications of this data structure, such as autocomplete and spellchecker.

Implement the Trie class:
- Trie() Initializes the trie object.
- void insert(String word) Inserts the string word into the trie.
- boolean search(String word) Returns true if the string word is in the trie (i.e., was inserted before), and false otherwise.
- boolean startsWith(String prefix) Returns true if there is a previously inserted string word that has the prefix prefix, and false otherwise.

Constraints:
- 1 <= word.length, prefix.length <= 2000
- word and prefix consist only of lowercase English letters.
- At most 3 * 10^4 calls in total will be made to insert, search, and startsWith.', 'medium', ARRAY['hash-table', 'string', 'design', 'trie'], ARRAY['Each trie node should have an array/map of children (26 letters)', 'Use a boolean flag to mark end of word', 'Insert: traverse/create nodes for each character', 'Search: traverse and check if final node is marked as end'], '[{"input": "[\"Trie\", \"insert\", \"search\", \"search\", \"startsWith\", \"insert\", \"search\"][[],[\"apple\"],[\"apple\"],[\"app\"],[\"app\"],[\"app\"],[\"app\"]]", "output": "[null, null, true, false, true, null, true]", "explanation": "Trie trie = new Trie(); trie.insert(\"apple\"); trie.search(\"apple\"); // return True; trie.search(\"app\"); // return False; trie.startsWith(\"app\"); // return True; trie.insert(\"app\"); trie.search(\"app\"); // return True"}]'::jsonb, 'O(m)', 'O(m * n)', 'https://leetcode.com/problems/implement-trie-prefix-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BACKTRACKING ==========

('subsets', 'Subsets', 'Given an integer array nums of unique elements, return all possible subsets (the power set). The solution set must not contain duplicate subsets. Return the solution in any order.

Constraints:
- 1 <= nums.length <= 10
- -10 <= nums[i] <= 10
- All the numbers of nums are unique.', 'medium', ARRAY['array', 'backtracking', 'bit-manipulation'], ARRAY['For each element, you have two choices: include it or exclude it', 'Use backtracking to explore both branches', 'Alternative: use bit manipulation (2^n combinations)', 'Each recursion level decides whether to include current element'], '[{"input": "nums = [1,2,3]", "output": "[[],[1],[2],[1,2],[3],[1,3],[2,3],[1,2,3]]", "explanation": "The power set contains all possible subsets including empty set."}, {"input": "nums = [0]", "output": "[[],[0]]", "explanation": "Only two subsets: empty and the single element."}]'::jsonb, 'O(n * 2^n)', 'O(n)', 'https://leetcode.com/problems/subsets/', ARRAY['neetcode-150', 'striver-a-z']),

('combination-sum', 'Combination Sum', 'Given an array of distinct integers candidates and a target integer target, return a list of all unique combinations of candidates where the chosen numbers sum to target. You may return the combinations in any order. The same number may be chosen from candidates an unlimited number of times. Two combinations are unique if the frequency of at least one of the chosen numbers is different.

The test cases are generated such that the number of unique combinations that sum up to target is less than 150 combinations for the given input.

Constraints:
- 1 <= candidates.length <= 30
- 2 <= candidates[i] <= 40
- All elements of candidates are distinct.
- 1 <= target <= 40', 'medium', ARRAY['array', 'backtracking'], ARRAY['Use backtracking to explore all combinations', 'You can reuse the same element, so don''t increment index in one branch', 'If current sum exceeds target, backtrack immediately', 'Sort array first for easier pruning'], '[{"input": "candidates = [2,3,6,7], target = 7", "output": "[[2,2,3],[7]]", "explanation": "2+2+3=7 and 7=7 are the only combinations."}, {"input": "candidates = [2,3,5], target = 8", "output": "[[2,2,2,2],[2,3,3],[3,5]]", "explanation": "Multiple ways to reach sum of 8."}, {"input": "candidates = [2], target = 1", "output": "[]", "explanation": "No combinations sum to 1."}]'::jsonb, 'O(n^(t/m))', 'O(t/m)', 'https://leetcode.com/problems/combination-sum/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('permutations', 'Permutations', 'Given an array nums of distinct integers, return all the possible permutations. You can return the answer in any order.

Constraints:
- 1 <= nums.length <= 6
- -10 <= nums[i] <= 10
- All the integers of nums are unique.', 'medium', ARRAY['array', 'backtracking'], ARRAY['Use backtracking by swapping elements in place', 'Alternative: use a visited/used array to track which elements are used', 'Each position can be filled with any unused element', 'When all positions filled, add current permutation to result'], '[{"input": "nums = [1,2,3]", "output": "[[1,2,3],[1,3,2],[2,1,3],[2,3,1],[3,1,2],[3,2,1]]", "explanation": "All 6 permutations of 3 elements."}, {"input": "nums = [0,1]", "output": "[[0,1],[1,0]]", "explanation": "Two permutations of 2 elements."}, {"input": "nums = [1]", "output": "[[1]]", "explanation": "Single element has only one permutation."}]'::jsonb, 'O(n * n!)', 'O(n!)', 'https://leetcode.com/problems/permutations/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('word-search', 'Word Search', 'Given an m x n grid of characters board and a string word, return true if word exists in the grid. The word can be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once.

Constraints:
- m == board.length
- n = board[i].length
- 1 <= m, n <= 6
- 1 <= word.length <= 15
- board and word consists of only lowercase and uppercase English letters.

Follow-up: Could you use search pruning to make your solution faster with a larger board?', 'medium', ARRAY['array', 'matrix', 'backtracking'], ARRAY['Start DFS from every cell that matches the first character', 'Mark current cell as visited (modify it temporarily)', 'Explore all 4 directions for next character', 'Backtrack by restoring the original cell value'], '[{"input": "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"ABCCED\"", "output": "true", "explanation": "Path: A(0,0) → B(0,1) → C(0,2) → C(1,2) → E(1,3) → D(2,2)."}, {"input": "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"SEE\"", "output": "true", "explanation": "Path exists for SEE."}, {"input": "board = [[\"A\",\"B\",\"C\",\"E\"],[\"S\",\"F\",\"C\",\"S\"],[\"A\",\"D\",\"E\",\"E\"]], word = \"ABCB\"", "output": "false", "explanation": "Cannot reuse the same cell."}]'::jsonb, 'O(m * n * 4^L)', 'O(L)', 'https://leetcode.com/problems/word-search/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== GRAPHS ==========

('number-of-islands', 'Number of Islands', 'Given an m x n 2D binary grid grid which represents a map of ''1''s (land) and ''0''s (water), return the number of islands. An island is surrounded by water and is formed by connecting adjacent lands horizontally or vertically. You may assume all four edges of the grid are all surrounded by water.

Constraints:
- m == grid.length
- n == grid[i].length
- 1 <= m, n <= 300
- grid[i][j] is ''0'' or ''1''.', 'medium', ARRAY['array', 'matrix', 'depth-first-search', 'breadth-first-search', 'union-find'], ARRAY['Iterate through grid and start DFS/BFS when you find land (''1'')', 'Mark visited land as ''0'' or use a visited set', 'Each DFS/BFS call explores one complete island', 'Count how many times you initiate DFS/BFS'], '[{"input": "grid = [[\"1\",\"1\",\"1\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"1\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"0\",\"0\"]]", "output": "1", "explanation": "All the 1s are connected forming one island."}, {"input": "grid = [[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"1\",\"1\",\"0\",\"0\",\"0\"],[\"0\",\"0\",\"1\",\"0\",\"0\"],[\"0\",\"0\",\"0\",\"1\",\"1\"]]", "output": "3", "explanation": "Three separate islands exist."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/number-of-islands/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('clone-graph', 'Clone Graph', 'Given a reference of a node in a connected undirected graph. Return a deep copy (clone) of the graph. Each node in the graph contains a value (int) and a list (List[Node]) of its neighbors.

Test case format:
For simplicity, each node''s value is the same as the node''s index (1-indexed). For example, the first node with val == 1, the second node with val == 2, and so on. The graph is represented in the test case using an adjacency list.

An adjacency list is a collection of unordered lists used to represent a finite graph. Each list describes the set of neighbors of a node in the graph.

The given node will always be the first node with val = 1. You must return the copy of the given node as a reference to the cloned graph.

Constraints:
- The number of nodes in the graph is in the range [0, 100].
- 1 <= Node.val <= 100
- Node.val is unique for each node.
- There are no repeated edges and no self-loops in the graph.
- The Graph is connected and all nodes can be visited starting from the given node.', 'medium', ARRAY['hash-table', 'graph', 'depth-first-search', 'breadth-first-search'], ARRAY['Use a hash map to store mapping from original nodes to cloned nodes', 'Use DFS or BFS to traverse the graph', 'When visiting a node, first check if it''s already cloned', 'Clone the node and its neighbors recursively'], '[{"input": "adjList = [[2,4],[1,3],[2,4],[1,3]]", "output": "[[2,4],[1,3],[2,4],[1,3]]", "explanation": "There are 4 nodes in the graph. Node 1''s value is 1, and it has two neighbors: Node 2 and 4. Node 2''s value is 2, and it has two neighbors: Node 1 and 3. Node 3''s value is 3, and it has two neighbors: Node 2 and 4. Node 4''s value is 4, and it has two neighbors: Node 1 and 3."}, {"input": "adjList = [[]]", "output": "[[]]", "explanation": "Single node with no neighbors."}, {"input": "adjList = []", "output": "[]", "explanation": "Empty graph."}]'::jsonb, 'O(V + E)', 'O(V)', 'https://leetcode.com/problems/clone-graph/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('course-schedule', 'Course Schedule', 'There are a total of numCourses courses you have to take, labeled from 0 to numCourses - 1. You are given an array prerequisites where prerequisites[i] = [ai, bi] indicates that you must take course bi first if you want to take course ai.

For example, the pair [0, 1], indicates that to take course 0 you have to first take course 1.

Return true if you can finish all courses. Otherwise, return false.

Constraints:
- 1 <= numCourses <= 2000
- 0 <= prerequisites.length <= 5000
- prerequisites[i].length == 2
- 0 <= ai, bi < numCourses
- All the pairs prerequisites[i] are unique.', 'medium', ARRAY['graph', 'depth-first-search', 'breadth-first-search', 'topological-sort'], ARRAY['This is a cycle detection problem in a directed graph', 'Use Kahn''s algorithm (BFS with indegree) or DFS with recursion stack', 'If a cycle exists, you cannot finish all courses', 'Track visited, visiting, and unvisited states for DFS approach'], '[{"input": "numCourses = 2, prerequisites = [[1,0]]", "output": "true", "explanation": "Take course 0 first, then course 1. Total of 2 courses."}, {"input": "numCourses = 2, prerequisites = [[1,0],[0,1]]", "output": "false", "explanation": "Circular dependency: to take course 1 you need 0, but to take 0 you need 1."}]'::jsonb, 'O(V + E)', 'O(V + E)', 'https://leetcode.com/problems/course-schedule/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('pacific-atlantic-water-flow', 'Pacific Atlantic Water Flow', 'There is an m x n rectangular island that borders both the Pacific Ocean and Atlantic Ocean. The Pacific Ocean touches the island''s left and top edges, and the Atlantic Ocean touches the island''s right and bottom edges.

The island is partitioned into a grid of square cells. You are given an m x n integer matrix heights where heights[r][c] represents the height above sea level of the cell at coordinate (r, c).

The island receives a lot of rain, and the rain water can flow to neighboring cells directly north, south, east, and west if the neighboring cell''s height is less than or equal to the current cell''s height. Water can flow from any cell adjacent to an ocean into the ocean.

Return a 2D list of grid coordinates result where result[i] = [ri, ci] denotes that rain water can flow from cell (ri, ci) to both the Pacific and Atlantic oceans.

Constraints:
- m == heights.length
- n == heights[r].length
- 1 <= m, n <= 200
- 0 <= heights[r][c] <= 10^5', 'medium', ARRAY['array', 'matrix', 'depth-first-search', 'breadth-first-search'], ARRAY['Work backwards: start DFS from ocean edges', 'Find all cells that can reach Pacific (from top and left edges)', 'Find all cells that can reach Atlantic (from bottom and right edges)', 'Return intersection of both sets'], '[{"input": "heights = [[1,2,2,3,5],[3,2,3,4,4],[2,4,5,3,1],[6,7,1,4,5],[5,1,1,2,4]]", "output": "[[0,4],[1,3],[1,4],[2,2],[3,0],[3,1],[4,0]]", "explanation": "These cells can flow to both oceans."}, {"input": "heights = [[1]]", "output": "[[0,0]]", "explanation": "Single cell touches both oceans."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/pacific-atlantic-water-flow/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== DYNAMIC PROGRAMMING (1D) ==========

('climbing-stairs', 'Climbing Stairs', 'You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?

Constraints:
- 1 <= n <= 45', 'easy', ARRAY['math', 'dynamic-programming', 'memoization'], ARRAY['This is a Fibonacci sequence problem', 'To reach step n, you can come from step n-1 or n-2', 'Base cases: f(1) = 1, f(2) = 2', 'Can optimize space to O(1) by keeping only last two values'], '[{"input": "n = 2", "output": "2", "explanation": "Two ways: 1+1 or 2."}, {"input": "n = 3", "output": "3", "explanation": "Three ways: 1+1+1, 1+2, or 2+1."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/climbing-stairs/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('house-robber', 'House Robber', 'You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed, the only constraint stopping you from robbing each of them is that adjacent houses have security systems connected and it will automatically contact the police if two adjacent houses were broken into on the same night.

Given an integer array nums representing the amount of money of each house, return the maximum amount of money you can rob tonight without alerting the police.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 400', 'medium', ARRAY['array', 'dynamic-programming'], ARRAY['For each house, you have two choices: rob it or skip it', 'If you rob current house, you can''t rob previous house', 'dp[i] = max(dp[i-1], dp[i-2] + nums[i])', 'Can optimize to O(1) space by tracking only prev1 and prev2'], '[{"input": "nums = [1,2,3,1]", "output": "4", "explanation": "Rob house 1 (money = 1) and then rob house 3 (money = 3). Total = 1 + 3 = 4."}, {"input": "nums = [2,7,9,3,1]", "output": "12", "explanation": "Rob house 1 (money = 2), rob house 3 (money = 9) and rob house 5 (money = 1). Total = 2 + 9 + 1 = 12."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/house-robber/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-increasing-subsequence', 'Longest Increasing Subsequence', 'Given an integer array nums, return the length of the longest strictly increasing subsequence.

Constraints:
- 1 <= nums.length <= 2500
- -10^4 <= nums[i] <= 10^4

Follow-up: Can you come up with an algorithm that runs in O(n log n) time complexity?', 'medium', ARRAY['array', 'binary-search', 'dynamic-programming'], ARRAY['DP approach: dp[i] = length of LIS ending at index i', 'For each i, check all j < i where nums[j] < nums[i]', 'Optimization: use binary search with a tails array', 'Tails array: tails[i] = smallest tail element of all LIS of length i+1'], '[{"input": "nums = [10,9,2,5,3,7,101,18]", "output": "4", "explanation": "The longest increasing subsequence is [2,3,7,101] or [2,3,7,18], therefore the length is 4."}, {"input": "nums = [0,1,0,3,2,3]", "output": "4", "explanation": "One possible LIS is [0,1,2,3]."}, {"input": "nums = [7,7,7,7,7,7,7]", "output": "1", "explanation": "All elements are the same, so LIS length is 1."}]'::jsonb, 'O(n log n)', 'O(n)', 'https://leetcode.com/problems/longest-increasing-subsequence/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('coin-change', 'Coin Change', 'You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1. You may assume that you have an infinite number of each kind of coin.

Constraints:
- 1 <= coins.length <= 12
- 1 <= coins[i] <= 2^31 - 1
- 0 <= amount <= 10^4', 'medium', ARRAY['array', 'dynamic-programming', 'breadth-first-search'], ARRAY['Use DP where dp[i] = minimum coins needed to make amount i', 'Initialize dp array with infinity (or amount + 1)', 'For each amount, try all coin denominations', 'dp[i] = min(dp[i], dp[i - coin] + 1)'], '[{"input": "coins = [1,2,5], amount = 11", "output": "3", "explanation": "11 = 5 + 5 + 1"}, {"input": "coins = [2], amount = 3", "output": "-1", "explanation": "Cannot make amount 3 with only coin denomination 2."}, {"input": "coins = [1], amount = 0", "output": "0", "explanation": "No coins needed for amount 0."}]'::jsonb, 'O(amount * n)', 'O(amount)', 'https://leetcode.com/problems/coin-change/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('word-break', 'Word Break', 'Given a string s and a dictionary of strings wordDict, return true if s can be segmented into a space-separated sequence of one or more dictionary words. Note that the same word in the dictionary may be reused multiple times in the segmentation.

Constraints:
- 1 <= s.length <= 300
- 1 <= wordDict.length <= 1000
- 1 <= wordDict[i].length <= 20
- s and wordDict[i] consist of only lowercase English letters.
- All the strings of wordDict are unique.', 'medium', ARRAY['hash-table', 'string', 'dynamic-programming', 'trie', 'memoization'], ARRAY['Use DP where dp[i] = true if s[0...i] can be segmented', 'For each position i, check all possible splits', 'If s[j...i] is in dictionary and dp[j] is true, then dp[i] = true', 'Can use a set for O(1) word lookup'], '[{"input": "s = \"leetcode\", wordDict = [\"leet\",\"code\"]", "output": "true", "explanation": "\"leetcode\" can be segmented as \"leet code\"."}, {"input": "s = \"applepenapple\", wordDict = [\"apple\",\"pen\"]", "output": "true", "explanation": "\"applepenapple\" can be segmented as \"apple pen apple\". Note that you can reuse a dictionary word."}, {"input": "s = \"catsandog\", wordDict = [\"cats\",\"dog\",\"sand\",\"and\",\"cat\"]", "output": "false", "explanation": "No valid segmentation exists."}]'::jsonb, 'O(n^2 * m)', 'O(n)', 'https://leetcode.com/problems/word-break/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z'])

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


-- Continuation: Dynamic Programming (2D), Intervals, Greedy, and Bit Manipulation

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== DYNAMIC PROGRAMMING (2D) ==========

('unique-paths', 'Unique Paths', 'There is a robot on an m x n grid. The robot is initially located at the top-left corner (i.e., grid[0][0]). The robot tries to move to the bottom-right corner (i.e., grid[m - 1][n - 1]). The robot can only move either down or right at any point in time.

Given the two integers m and n, return the number of possible unique paths that the robot can take to reach the bottom-right corner.

The test cases are generated so that the answer will be less than or equal to 2 * 10^9.

Constraints:
- 1 <= m, n <= 100', 'medium', ARRAY['math', 'dynamic-programming', 'combinatorics'], ARRAY['Use 2D DP where dp[i][j] = number of ways to reach cell (i,j)', 'dp[i][j] = dp[i-1][j] + dp[i][j-1]', 'Base case: first row and first column all have value 1', 'Can optimize to O(n) space by using 1D array'], '[{"input": "m = 3, n = 7", "output": "28", "explanation": "There are 28 unique paths from top-left to bottom-right."}, {"input": "m = 3, n = 2", "output": "3", "explanation": "From the top-left corner, there are a total of 3 ways to reach the bottom-right corner: 1. Right -> Down -> Down; 2. Down -> Down -> Right; 3. Down -> Right -> Down"}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/unique-paths/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-common-subsequence', 'Longest Common Subsequence', 'Given two strings text1 and text2, return the length of their longest common subsequence. If there is no common subsequence, return 0.

A subsequence of a string is a new string generated from the original string with some characters (can be none) deleted without changing the relative order of the remaining characters.

For example, "ace" is a subsequence of "abcde".

A common subsequence of two strings is a subsequence that is common to both strings.

Constraints:
- 1 <= text1.length, text2.length <= 1000
- text1 and text2 consist of only lowercase English characters.', 'medium', ARRAY['string', 'dynamic-programming'], ARRAY['Use 2D DP where dp[i][j] = LCS length for text1[0..i] and text2[0..j]', 'If characters match: dp[i][j] = 1 + dp[i-1][j-1]', 'If they don''t match: dp[i][j] = max(dp[i-1][j], dp[i][j-1])', 'Initialize first row and column with 0'], '[{"input": "text1 = \"abcde\", text2 = \"ace\"", "output": "3", "explanation": "The longest common subsequence is \"ace\" and its length is 3."}, {"input": "text1 = \"abc\", text2 = \"abc\"", "output": "3", "explanation": "The longest common subsequence is \"abc\" and its length is 3."}, {"input": "text1 = \"abc\", text2 = \"def\"", "output": "0", "explanation": "There is no common subsequence."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/longest-common-subsequence/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('edit-distance', 'Edit Distance', 'Given two strings word1 and word2, return the minimum number of operations required to convert word1 to word2.

You have the following three operations permitted on a word:
- Insert a character
- Delete a character
- Replace a character

Constraints:
- 0 <= word1.length, word2.length <= 500
- word1 and word2 consist of lowercase English letters.', 'hard', ARRAY['string', 'dynamic-programming'], ARRAY['Use 2D DP where dp[i][j] = min operations to convert word1[0..i] to word2[0..j]', 'If characters match: dp[i][j] = dp[i-1][j-1]', 'If different: dp[i][j] = 1 + min(insert, delete, replace)', 'Insert: dp[i][j-1], Delete: dp[i-1][j], Replace: dp[i-1][j-1]'], '[{"input": "word1 = \"horse\", word2 = \"ros\"", "output": "3", "explanation": "horse -> rorse (replace ''h'' with ''r''); rorse -> rose (remove ''r''); rose -> ros (remove ''e'')"}, {"input": "word1 = \"intention\", word2 = \"execution\"", "output": "5", "explanation": "intention -> inention (remove ''t''); inention -> enention (replace ''i'' with ''e''); enention -> exention (replace ''n'' with ''x''); exention -> exection (replace ''n'' with ''c''); exection -> execution (insert ''u'')"}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/edit-distance/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== INTERVALS ==========

('insert-interval', 'Insert Interval', 'You are given an array of non-overlapping intervals intervals where intervals[i] = [starti, endi] represent the start and the end of the ith interval and intervals is sorted in ascending order by starti. You are also given an interval newInterval = [start, end] that represents the start and end of another interval.

Insert newInterval into intervals such that intervals is still sorted in ascending order by starti and intervals still does not have any overlapping intervals (merge overlapping intervals if necessary).

Return intervals after the insertion.

Constraints:
- 0 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= starti <= endi <= 10^5
- intervals is sorted by starti in ascending order.
- newInterval.length == 2
- 0 <= start <= end <= 10^5', 'medium', ARRAY['array'], ARRAY['Add all intervals that end before newInterval starts', 'Merge all overlapping intervals with newInterval', 'Add all intervals that start after newInterval ends', 'Track min start and max end while merging'], '[{"input": "intervals = [[1,3],[6,9]], newInterval = [2,5]", "output": "[[1,5],[6,9]]", "explanation": "The new interval [2,5] overlaps with [1,3], so they merge to [1,5]."}, {"input": "intervals = [[1,2],[3,5],[6,7],[8,10],[12,16]], newInterval = [4,8]", "output": "[[1,2],[3,10],[12,16]]", "explanation": "[4,8] merges with [3,5], [6,7], and [8,10]."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/insert-interval/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('merge-intervals', 'Merge Intervals', 'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals, and return an array of the non-overlapping intervals that cover all the intervals in the input.

Constraints:
- 1 <= intervals.length <= 10^4
- intervals[i].length == 2
- 0 <= starti <= endi <= 10^4', 'medium', ARRAY['array', 'sorting'], ARRAY['Sort intervals by start time first', 'Iterate through sorted intervals', 'If current interval overlaps with previous, merge them', 'Otherwise, add previous interval to result and start new one'], '[{"input": "intervals = [[1,3],[2,6],[8,10],[15,18]]", "output": "[[1,6],[8,10],[15,18]]", "explanation": "Since intervals [1,3] and [2,6] overlap, merge them into [1,6]."}, {"input": "intervals = [[1,4],[4,5]]", "output": "[[1,5]]", "explanation": "Intervals [1,4] and [4,5] are considered overlapping."}]'::jsonb, 'O(n log n)', 'O(n)', 'https://leetcode.com/problems/merge-intervals/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('non-overlapping-intervals', 'Non-overlapping Intervals', 'Given an array of intervals intervals where intervals[i] = [starti, endi], return the minimum number of intervals you need to remove to make the rest of the intervals non-overlapping.

Constraints:
- 1 <= intervals.length <= 10^5
- intervals[i].length == 2
- -5 * 10^4 <= starti < endi <= 5 * 10^4', 'medium', ARRAY['array', 'greedy', 'sorting', 'dynamic-programming'], ARRAY['Sort intervals by end time (greedy approach)', 'Keep track of the end of the last added interval', 'If current interval starts before last end, it overlaps - remove it', 'Otherwise, update the last end time'], '[{"input": "intervals = [[1,2],[2,3],[3,4],[1,3]]", "output": "1", "explanation": "Remove [1,3] to make the rest non-overlapping."}, {"input": "intervals = [[1,2],[1,2],[1,2]]", "output": "2", "explanation": "Remove 2 intervals to keep one."}, {"input": "intervals = [[1,2],[2,3]]", "output": "0", "explanation": "No intervals need to be removed."}]'::jsonb, 'O(n log n)', 'O(1)', 'https://leetcode.com/problems/non-overlapping-intervals/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== GREEDY ==========

('maximum-subarray', 'Maximum Subarray', 'Given an integer array nums, find the subarray with the largest sum, and return its sum.

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4

Follow-up: If you have figured out the O(n) solution, try coding another solution using the divide and conquer approach, which is more subtle.', 'medium', ARRAY['array', 'divide-and-conquer', 'dynamic-programming'], ARRAY['Kadane''s Algorithm: track current sum and max sum', 'If current sum becomes negative, reset it to 0', 'Update max sum at each step', 'The max sum seen is the answer'], '[{"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "The subarray [4,-1,2,1] has the largest sum 6."}, {"input": "nums = [1]", "output": "1", "explanation": "The subarray [1] has the largest sum 1."}, {"input": "nums = [5,4,-1,7,8]", "output": "23", "explanation": "The subarray [5,4,-1,7,8] has the largest sum 23."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/maximum-subarray/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('jump-game', 'Jump Game', 'You are given an integer array nums. You are initially positioned at the array''s first index, and each element in the array represents your maximum jump length at that position.

Return true if you can reach the last index, or false otherwise.

Constraints:
- 1 <= nums.length <= 10^4
- 0 <= nums[i] <= 10^5', 'medium', ARRAY['array', 'dynamic-programming', 'greedy'], ARRAY['Work backwards from the end', 'Keep track of the leftmost position that can reach the end', 'If a position can jump to or beyond the goal, update goal to that position', 'Check if goal reaches index 0'], '[{"input": "nums = [2,3,1,1,4]", "output": "true", "explanation": "Jump 1 step from index 0 to 1, then 3 steps to the last index."}, {"input": "nums = [3,2,1,0,4]", "output": "false", "explanation": "You will always arrive at index 3 no matter what. Its maximum jump length is 0, which makes it impossible to reach the last index."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/jump-game/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BIT MANIPULATION ==========

('number-of-1-bits', 'Number of 1 Bits', 'Write a function that takes the binary representation of an unsigned integer and returns the number of ''1'' bits it has (also known as the Hamming weight).

Note:
- Note that in some languages, such as Java, there is no unsigned integer type. In this case, the input will be given as a signed integer type. It should not affect your implementation, as the integer''s internal binary representation is the same, whether it is signed or unsigned.
- In Java, the compiler represents the signed integers using 2''s complement notation. Therefore, in Example 3, the input represents the signed integer -3.

Constraints:
- The input must be a binary string of length 32.

Follow-up: If this function is called many times, how would you optimize it?', 'easy', ARRAY['divide-and-conquer', 'bit-manipulation'], ARRAY['Use n & (n - 1) to flip the rightmost 1-bit to 0', 'Count how many times you can do this until n becomes 0', 'Alternative: check each bit with n & 1 and right shift', 'Brian Kernighan''s algorithm is the most efficient'], '[{"input": "n = 00000000000000000000000000001011", "output": "3", "explanation": "The input binary string has three ''1'' bits."}, {"input": "n = 00000000000000000000000010000000", "output": "1", "explanation": "The input binary string has one ''1'' bit."}, {"input": "n = 11111111111111111111111111111101", "output": "31", "explanation": "The input binary string has thirty-one ''1'' bits."}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/number-of-1-bits/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('counting-bits', 'Counting Bits', 'Given an integer n, return an array ans of length n + 1 such that for each i (0 <= i <= n), ans[i] is the number of 1''s in the binary representation of i.

Constraints:
- 0 <= n <= 10^5

Follow-up:
- It is very easy to come up with a solution with a runtime of O(n log n). Can you do it in linear time O(n) and possibly in a single pass?
- Can you do it without using any built-in function (i.e., like __builtin_popcount in C++)?', 'easy', ARRAY['dynamic-programming', 'bit-manipulation'], ARRAY['Use the relation: bits[i] = bits[i >> 1] + (i & 1)', 'i >> 1 removes the rightmost bit', 'i & 1 checks if the rightmost bit is 1', 'Build answer array iteratively using previous results'], '[{"input": "n = 2", "output": "[0,1,1]", "explanation": "0 --> 0; 1 --> 1; 2 --> 10"}, {"input": "n = 5", "output": "[0,1,1,2,1,2]", "explanation": "0 --> 0; 1 --> 1; 2 --> 10; 3 --> 11; 4 --> 100; 5 --> 101"}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/counting-bits/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('missing-number', 'Missing Number', 'Given an array nums containing n distinct numbers in the range [0, n], return the only number in the range that is missing from the array.

Constraints:
- n == nums.length
- 1 <= n <= 10^4
- 0 <= nums[i] <= n
- All the numbers of nums are unique.

Follow-up: Could you implement a solution using only O(1) extra space complexity and O(n) runtime complexity?', 'easy', ARRAY['array', 'hash-table', 'math', 'binary-search', 'bit-manipulation', 'sorting'], ARRAY['Use XOR: XOR all indices and all values', 'The missing number will be left after XORing', 'Alternative: use sum formula n*(n+1)/2 - sum(nums)', 'XOR approach: a ^ a = 0, so duplicate numbers cancel out'], '[{"input": "nums = [3,0,1]", "output": "2", "explanation": "n = 3 since there are 3 numbers, so all numbers are in the range [0,3]. 2 is the missing number in the range since it does not appear in nums."}, {"input": "nums = [0,1]", "output": "2", "explanation": "n = 2 since there are 2 numbers, so all numbers are in the range [0,2]. 2 is the missing number."}, {"input": "nums = [9,6,4,2,3,5,7,0,1]", "output": "8", "explanation": "n = 9 since there are 9 numbers, so all numbers are in the range [0,9]. 8 is the missing number."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/missing-number/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('reverse-bits', 'Reverse Bits', 'Reverse bits of a given 32 bits unsigned integer.

Note:
- Note that in some languages, such as Java, there is no unsigned integer type. In this case, both input and output will be given as a signed integer type. They should not affect your implementation, as the integer''s internal binary representation is the same, whether it is signed or unsigned.
- In Java, the compiler represents the signed integers using 2''s complement notation. Therefore, in Example 2 above, the input represents the signed integer -3 and the output represents the signed integer -1073741825.

Constraints:
- The input must be a binary string of length 32

Follow-up: If this function is called many times, how would you optimize it?', 'easy', ARRAY['divide-and-conquer', 'bit-manipulation'], ARRAY['Iterate 32 times to process each bit', 'For each bit, left shift result and add current bit from n', 'Extract current bit with n & 1, then right shift n', 'Result = (result << 1) | (n & 1)'], '[{"input": "n = 00000010100101000001111010011100", "output": "964176192", "explanation": "The input binary string represents the unsigned integer 43261596, so return 964176192 which binary representation is 00111001011110000010100101000000."}, {"input": "n = 11111111111111111111111111111101", "output": "3221225471", "explanation": "The input binary string represents the unsigned integer 4294967293, so return 3221225471 which binary representation is 10111111111111111111111111111111."}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/reverse-bits/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== ADDITIONAL EASY PROBLEMS ==========

('roman-to-integer', 'Roman to Integer', 'Roman numerals are represented by seven different symbols: I, V, X, L, C, D and M.

Symbol       Value
I             1
V             5
X             10
L             50
C             100
D             500
M             1000

For example, 2 is written as II in Roman numeral, just two ones added together. 12 is written as XII, which is simply X + II. The number 27 is written as XXVII, which is XX + V + II.

Roman numerals are usually written largest to smallest from left to right. However, the numeral for four is not IIII. Instead, the number four is written as IV. Because the one is before the five we subtract it making four. The same principle applies to the number nine, which is written as IX. There are six instances where subtraction is used:
- I can be placed before V (5) and X (10) to make 4 and 9.
- X can be placed before L (50) and C (100) to make 40 and 90.
- C can be placed before D (500) and M (1000) to make 400 and 900.

Given a roman numeral, convert it to an integer.

Constraints:
- 1 <= s.length <= 15
- s contains only the characters (''I'', ''V'', ''X'', ''L'', ''C'', ''D'', ''M'').
- It is guaranteed that s is a valid roman numeral in the range [1, 3999].', 'easy', ARRAY['hash-table', 'math', 'string'], ARRAY['Create a map of roman characters to their values', 'Iterate through the string from left to right', 'If current value < next value, subtract current from result', 'Otherwise, add current to result'], '[{"input": "s = \"III\"", "output": "3", "explanation": "III = 3."}, {"input": "s = \"LVIII\"", "output": "58", "explanation": "L = 50, V = 5, III = 3."}, {"input": "s = \"MCMXCIV\"", "output": "1994", "explanation": "M = 1000, CM = 900, XC = 90 and IV = 4."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/roman-to-integer/', ARRAY['grind-75', 'striver-a-z']),

('longest-common-prefix', 'Longest Common Prefix', 'Write a function to find the longest common prefix string amongst an array of strings. If there is no common prefix, return an empty string "".

Constraints:
- 1 <= strs.length <= 200
- 0 <= strs[i].length <= 200
- strs[i] consists of only lowercase English letters.', 'easy', ARRAY['string', 'trie'], ARRAY['Sort the array and compare only first and last strings', 'Or compare character by character across all strings', 'The prefix can''t be longer than the shortest string', 'Stop when you find a mismatch'], '[{"input": "strs = [\"flower\",\"flow\",\"flight\"]", "output": "\"fl\"", "explanation": "The longest common prefix is \"fl\"."}, {"input": "strs = [\"dog\",\"racecar\",\"car\"]", "output": "\"\"", "explanation": "There is no common prefix among the input strings."}]'::jsonb, 'O(n * m)', 'O(1)', 'https://leetcode.com/problems/longest-common-prefix/', ARRAY['grind-75', 'striver-a-z']),

('length-of-last-word', 'Length of Last Word', 'Given a string s consisting of words and spaces, return the length of the last word in the string. A word is a maximal substring consisting of non-space characters only.

Constraints:
- 1 <= s.length <= 10^4
- s consists of only English letters and spaces '' ''.
- There will be at least one word in s.', 'easy', ARRAY['string'], ARRAY['Trim trailing spaces first', 'Count characters from the end until you hit a space or start', 'Or split by spaces and return length of last non-empty word', 'Be careful with trailing spaces'], '[{"input": "s = \"Hello World\"", "output": "5", "explanation": "The last word is \"World\" with length 5."}, {"input": "s = \"   fly me   to   the moon  \"", "output": "4", "explanation": "The last word is \"moon\" with length 4."}, {"input": "s = \"luffy is still joyboy\"", "output": "6", "explanation": "The last word is \"joyboy\" with length 6."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/length-of-last-word/', ARRAY['neetcode-150', 'striver-a-z']),

('plus-one', 'Plus One', 'You are given a large integer represented as an integer array digits, where each digits[i] is the ith digit of the integer. The digits are ordered from most significant to least significant in left-to-right order. The large integer does not contain any leading 0''s.

Increment the large integer by one and return the resulting array of digits.

Constraints:
- 1 <= digits.length <= 100
- 0 <= digits[i] <= 9
- digits does not contain any leading 0''s.', 'easy', ARRAY['array', 'math'], ARRAY['Start from the last digit and add 1', 'Handle carry propagation', 'If all digits are 9, you need a new array with leading 1', 'Most cases only affect the last digit'], '[{"input": "digits = [1,2,3]", "output": "[1,2,4]", "explanation": "The array represents the integer 123. Incrementing by one gives 123 + 1 = 124."}, {"input": "digits = [4,3,2,1]", "output": "[4,3,2,2]", "explanation": "The array represents the integer 4321."}, {"input": "digits = [9]", "output": "[1,0]", "explanation": "The array represents the integer 9. Incrementing by one gives 9 + 1 = 10."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/plus-one/', ARRAY['neetcode-150', 'striver-a-z']),

('find-the-index-of-the-first-occurrence-in-a-string', 'Find the Index of the First Occurrence in a String', 'Given two strings needle and haystack, return the index of the first occurrence of needle in haystack, or -1 if needle is not part of haystack.

Constraints:
- 1 <= haystack.length, needle.length <= 10^4
- haystack and needle consist of only lowercase English characters.', 'easy', ARRAY['two-pointers', 'string', 'string-matching'], ARRAY['Use a sliding window of size needle.length', 'Compare each window with needle', 'Can use built-in indexOf/find functions', 'KMP algorithm for O(n+m) solution'], '[{"input": "haystack = \"sadbutsad\", needle = \"sad\"", "output": "0", "explanation": "\"sad\" occurs at index 0 and 6. The first occurrence is at index 0."}, {"input": "haystack = \"leetcode\", needle = \"leeto\"", "output": "-1", "explanation": "\"leeto\" did not occur in \"leetcode\"."}]'::jsonb, 'O(n * m)', 'O(1)', 'https://leetcode.com/problems/find-the-index-of-the-first-occurrence-in-a-string/', ARRAY['neetcode-150', 'striver-a-z']),

('move-zeroes', 'Move Zeroes', 'Given an integer array nums, move all 0''s to the end of it while maintaining the relative order of the non-zero elements. Note that you must do this in-place without making a copy of the array.

Constraints:
- 1 <= nums.length <= 10^4
- -2^31 <= nums[i] <= 2^31 - 1

Follow-up: Could you minimize the total number of operations done?', 'easy', ARRAY['array', 'two-pointers'], ARRAY['Use one pointer to track position for next non-zero element', 'Iterate through array and move non-zero elements forward', 'Swap non-zero elements to the tracked position', 'All zeros naturally move to the end'], '[{"input": "nums = [0,1,0,3,12]", "output": "[1,3,12,0,0]", "explanation": "Non-zero elements maintain their order."}, {"input": "nums = [0]", "output": "[0]", "explanation": "Single zero element."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/move-zeroes/', ARRAY['grind-75', 'striver-a-z'])

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

-- Continuation: More Easy/Medium Problems and Advanced Topics

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== LINKED LIST (Continued) ==========

('linked-list-cycle-ii', 'Linked List Cycle II', 'Given the head of a linked list, return the node where the cycle begins. If there is no cycle, return null.

There is a cycle in a linked list if there is some node in the list that can be reached again by continuously following the next pointer. Internally, pos is used to denote the index of the node that tail''s next pointer is connected to (0-indexed). It is -1 if there is no cycle. Note that pos is not passed as a parameter.

Do not modify the linked list.

Constraints:
- The number of the nodes in the list is in the range [0, 10^4].
- -10^5 <= Node.val <= 10^5
- pos is -1 or a valid index in the linked-list.

Follow-up: Can you solve it using O(1) (i.e. constant) memory?', 'medium', ARRAY['hash-table', 'linked-list', 'two-pointers'], ARRAY['Use Floyd''s cycle detection to find if cycle exists', 'Once slow and fast meet, reset one pointer to head', 'Move both pointers at same speed until they meet again', 'The meeting point is the cycle start'], '[{"input": "head = [3,2,0,-4], pos = 1", "output": "tail connects to node index 1", "explanation": "There is a cycle, where tail connects to the second node."}, {"input": "head = [1,2], pos = 0", "output": "tail connects to node index 0", "explanation": "There is a cycle, where tail connects to the first node."}, {"input": "head = [1], pos = -1", "output": "no cycle", "explanation": "There is no cycle in the linked list."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/linked-list-cycle-ii/', ARRAY['striver-a-z']),

('middle-of-the-linked-list', 'Middle of the Linked List', 'Given the head of a singly linked list, return the middle node of the linked list. If there are two middle nodes, return the second middle node.

Constraints:
- The number of nodes in the list is in the range [1, 100].
- 1 <= Node.val <= 100', 'easy', ARRAY['linked-list', 'two-pointers'], ARRAY['Use slow and fast pointers', 'Move slow one step and fast two steps', 'When fast reaches end, slow is at middle', 'For even length lists, this returns the second middle'], '[{"input": "head = [1,2,3,4,5]", "output": "[3,4,5]", "explanation": "The middle node of the list is node 3."}, {"input": "head = [1,2,3,4,5,6]", "output": "[4,5,6]", "explanation": "Since the list has two middle nodes with values 3 and 4, we return the second one."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/middle-of-the-linked-list/', ARRAY['grind-75', 'striver-a-z']),

-- ========== BINARY TREE (Easy) ==========

('path-sum', 'Path Sum', 'Given the root of a binary tree and an integer targetSum, return true if the tree has a root-to-leaf path such that adding up all the values along the path equals targetSum.

A leaf is a node with no children.

Constraints:
- The number of nodes in the tree is in the range [0, 5000].
- -1000 <= Node.val <= 1000
- -1000 <= targetSum <= 1000', 'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Subtract current node value from targetSum', 'Recursively check left and right subtrees', 'Base case: if leaf node, check if remaining sum equals node value', 'Return true if either left or right path returns true'], '[{"input": "root = [5,4,8,11,null,13,4,7,2,null,null,null,1], targetSum = 22", "output": "true", "explanation": "The root-to-leaf path with target sum is 5->4->11->2."}, {"input": "root = [1,2,3], targetSum = 5", "output": "false", "explanation": "No root-to-leaf path sums to 5."}, {"input": "root = [], targetSum = 0", "output": "false", "explanation": "Empty tree has no paths."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/path-sum/', ARRAY['grind-75', 'striver-a-z']),

('minimum-depth-of-binary-tree', 'Minimum Depth of Binary Tree', 'Given a binary tree, find its minimum depth. The minimum depth is the number of nodes along the shortest path from the root node down to the nearest leaf node.

Note: A leaf is a node with no children.

Constraints:
- The number of nodes in the tree is in the range [0, 10^5].
- -1000 <= Node.val <= 1000', 'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], ARRAY['Use BFS to find first leaf node for optimal solution', 'With DFS, must handle case where one child is null', 'If one child is null, return depth of the other child + 1', 'If both children exist, return min(left, right) + 1'], '[{"input": "root = [3,9,20,null,null,15,7]", "output": "2", "explanation": "The minimum depth is 2 (path: 3->9)."}, {"input": "root = [2,null,3,null,4,null,5,null,6]", "output": "5", "explanation": "The tree is a chain, so minimum depth is 5."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/minimum-depth-of-binary-tree/', ARRAY['striver-a-z']),

('binary-tree-postorder-traversal', 'Binary Tree Postorder Traversal', 'Given the root of a binary tree, return the postorder traversal of its nodes'' values.

Constraints:
- The number of the nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

Follow-up: Recursive solution is trivial, could you do it iteratively?', 'easy', ARRAY['stack', 'tree', 'depth-first-search', 'binary-tree'], ARRAY['Postorder: Left -> Right -> Root', 'Recursive: visit left, visit right, process current', 'Iterative: use two stacks or reverse of modified preorder', 'Modified preorder (Root->Right->Left) reversed gives postorder'], '[{"input": "root = [1,null,2,3]", "output": "[3,2,1]", "explanation": "Postorder traversal visits left subtree, right subtree, then root."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree."}, {"input": "root = [1]", "output": "[1]", "explanation": "Single node."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-postorder-traversal/', ARRAY['striver-a-z']),

('binary-tree-preorder-traversal', 'Binary Tree Preorder Traversal', 'Given the root of a binary tree, return the preorder traversal of its nodes'' values.

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

Follow-up: Recursive solution is trivial, could you do it iteratively?', 'easy', ARRAY['stack', 'tree', 'depth-first-search', 'binary-tree'], ARRAY['Preorder: Root -> Left -> Right', 'Recursive: process current, visit left, visit right', 'Iterative: use a stack, push right child first then left', 'Process nodes as you pop them from stack'], '[{"input": "root = [1,null,2,3]", "output": "[1,2,3]", "explanation": "Preorder visits root, then left subtree, then right subtree."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree."}, {"input": "root = [1]", "output": "[1]", "explanation": "Single node."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-preorder-traversal/', ARRAY['striver-a-z']),

('binary-tree-inorder-traversal', 'Binary Tree Inorder Traversal', 'Given the root of a binary tree, return the inorder traversal of its nodes'' values.

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

Follow-up: Recursive solution is trivial, could you do it iteratively?', 'easy', ARRAY['stack', 'tree', 'depth-first-search', 'binary-tree'], ARRAY['Inorder: Left -> Root -> Right', 'Recursive: visit left, process current, visit right', 'Iterative: use stack to go left as far as possible', 'Process node when popping, then go to right child'], '[{"input": "root = [1,null,2,3]", "output": "[1,3,2]", "explanation": "Inorder traversal of the tree."}, {"input": "root = []", "output": "[]", "explanation": "Empty tree."}, {"input": "root = [1]", "output": "[1]", "explanation": "Single node."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-inorder-traversal/', ARRAY['striver-a-z']),

-- ========== MATH & BIT MANIPULATION (Easy) ==========

('palindrome-number', 'Palindrome Number', 'Given an integer x, return true if x is a palindrome, and false otherwise.

Constraints:
- -2^31 <= x <= 2^31 - 1

Follow-up: Could you solve it without converting the integer to a string?', 'easy', ARRAY['math'], ARRAY['Negative numbers are not palindromes', 'Reverse the number and compare with original', 'Or reverse only half the number to avoid overflow', 'Number is palindrome if first half equals reversed second half'], '[{"input": "x = 121", "output": "true", "explanation": "121 reads as 121 from left to right and from right to left."}, {"input": "x = -121", "output": "false", "explanation": "From left to right, it reads -121. From right to left, it becomes 121-."}, {"input": "x = 10", "output": "false", "explanation": "Reads 01 from right to left."}]'::jsonb, 'O(log n)', 'O(1)', 'https://leetcode.com/problems/palindrome-number/', ARRAY['grind-75', 'striver-a-z']),

('sqrtx', 'Sqrt(x)', 'Given a non-negative integer x, return the square root of x rounded down to the nearest integer. The returned integer should be non-negative as well.

You must not use any built-in exponent function or operator.

For example, do not use pow(x, 0.5) in c++ or x ** 0.5 in python.

Constraints:
- 0 <= x <= 2^31 - 1', 'easy', ARRAY['math', 'binary-search'], ARRAY['Use binary search between 1 and x', 'Check if mid * mid <= x and (mid+1) * (mid+1) > x', 'Be careful with overflow when computing mid * mid', 'Alternative: use Newton''s method for faster convergence'], '[{"input": "x = 4", "output": "2", "explanation": "The square root of 4 is 2."}, {"input": "x = 8", "output": "2", "explanation": "The square root of 8 is 2.82842..., which is rounded down to 2."}]'::jsonb, 'O(log n)', 'O(1)', 'https://leetcode.com/problems/sqrtx/', ARRAY['striver-a-z']),

('single-number', 'Single Number', 'Given a non-empty array of integers nums, every element appears twice except for one. Find that single one.

You must implement a solution with a linear runtime complexity and use only constant extra space.

Constraints:
- 1 <= nums.length <= 3 * 10^4
- -3 * 10^4 <= nums[i] <= 3 * 10^4
- Each element in the array appears twice except for one element which appears only once.', 'easy', ARRAY['array', 'bit-manipulation'], ARRAY['Use XOR operation: a ^ a = 0 and a ^ 0 = a', 'XOR all numbers together', 'Duplicate numbers cancel out, leaving only the single number', 'XOR is commutative and associative'], '[{"input": "nums = [2,2,1]", "output": "1", "explanation": "2 ^ 2 ^ 1 = 0 ^ 1 = 1"}, {"input": "nums = [4,1,2,1,2]", "output": "4", "explanation": "1 ^ 1 ^ 2 ^ 2 ^ 4 = 0 ^ 0 ^ 4 = 4"}, {"input": "nums = [1]", "output": "1", "explanation": "Only one element."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/single-number/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('power-of-two', 'Power of Two', 'Given an integer n, return true if it is a power of two. Otherwise, return false.

An integer n is a power of two, if there exists an integer x such that n == 2^x.

Constraints:
- -2^31 <= n <= 2^31 - 1

Follow-up: Could you solve it without loops/recursion?', 'easy', ARRAY['math', 'bit-manipulation', 'recursion'], ARRAY['A power of 2 has only one bit set in binary', 'Use n & (n - 1) == 0 to check', 'Also ensure n > 0', 'Powers of 2: 1, 2, 4, 8, 16, 32...'], '[{"input": "n = 1", "output": "true", "explanation": "2^0 = 1"}, {"input": "n = 16", "output": "true", "explanation": "2^4 = 16"}, {"input": "n = 3", "output": "false", "explanation": "3 is not a power of 2."}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/power-of-two/', ARRAY['striver-a-z']),

('add-binary', 'Add Binary', 'Given two binary strings a and b, return their sum as a binary string.

Constraints:
- 1 <= a.length, b.length <= 10^4
- a and b consist only of ''0'' or ''1'' characters.
- Each string does not contain leading zeros except for the zero itself.', 'easy', ARRAY['math', 'string', 'bit-manipulation', 'simulation'], ARRAY['Simulate binary addition from right to left', 'Keep track of carry', 'Process both strings digit by digit', 'Don''t forget final carry if it exists'], '[{"input": "a = \"11\", b = \"1\"", "output": "\"100\"", "explanation": "11 + 1 = 100 in binary."}, {"input": "a = \"1010\", b = \"1011\"", "output": "\"10101\"", "explanation": "1010 + 1011 = 10101 in binary."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/add-binary/', ARRAY['grind-75', 'striver-a-z']),

-- ========== STACK & QUEUE (Easy) ==========

('implement-queue-using-stacks', 'Implement Queue using Stacks', 'Implement a first in first out (FIFO) queue using only two stacks. The implemented queue should support all the functions of a normal queue (push, peek, pop, and empty).

Implement the MyQueue class:
- void push(int x) Pushes element x to the back of the queue.
- int pop() Removes the element from the front of the queue and returns it.
- int peek() Returns the element at the front of the queue.
- boolean empty() Returns true if the queue is empty, false otherwise.

Notes:
- You must use only standard operations of a stack, which means only push to top, peek/pop from top, size, and is empty operations are valid.
- Depending on your language, the stack may not be supported natively. You may simulate a stack using a list or deque (double-ended queue) as long as you use only a stack''s standard operations.

Constraints:
- 1 <= x <= 9
- At most 100 calls will be made to push, pop, peek, and empty.
- All the calls to pop and peek are valid.

Follow-up: Can you implement the queue such that each operation is amortized O(1) time complexity? In other words, performing n operations will take overall O(n) time even if one of those operations may take longer.', 'easy', ARRAY['stack', 'design', 'queue'], ARRAY['Use two stacks: input stack and output stack', 'Push always goes to input stack', 'For pop/peek, if output stack is empty, transfer all from input', 'This gives amortized O(1) time'], '[{"input": "[\"MyQueue\", \"push\", \"push\", \"peek\", \"pop\", \"empty\"][[],[1],[2],[],[],[]]", "output": "[null, null, null, 1, 1, false]", "explanation": "MyQueue myQueue = new MyQueue(); myQueue.push(1); myQueue.push(2); myQueue.peek(); // return 1; myQueue.pop(); // return 1; myQueue.empty(); // return false"}]'::jsonb, 'O(1) amortized', 'O(n)', 'https://leetcode.com/problems/implement-queue-using-stacks/', ARRAY['grind-75', 'striver-a-z']),

('implement-stack-using-queues', 'Implement Stack using Queues', 'Implement a last-in-first-out (LIFO) stack using only two queues. The implemented stack should support all the functions of a normal stack (push, top, pop, and empty).

Implement the MyStack class:
- void push(int x) Pushes element x to the top of the stack.
- int pop() Removes the element on the top of the stack and returns it.
- int top() Returns the element on the top of the stack.
- boolean empty() Returns true if the stack is empty, false otherwise.

Notes:
- You must use only standard operations of a queue, which means that only push to back, peek/pop from front, size and is empty operations are valid.
- Depending on your language, the queue may not be supported natively. You may simulate a queue using a list or deque (double-ended queue) as long as you use only a queue''s standard operations.

Constraints:
- 1 <= x <= 9
- At most 100 calls will be made to push, pop, top, and empty.
- All the calls to pop and top are valid.

Follow-up: Can you implement the stack using only one queue?', 'easy', ARRAY['stack', 'design', 'queue'], ARRAY['When pushing, add element then rotate queue', 'Rotate by dequeuing and enqueuing n-1 times', 'This makes the new element the front', 'Pop and top become simple front operations'], '[{"input": "[\"MyStack\", \"push\", \"push\", \"top\", \"pop\", \"empty\"][[],[1],[2],[],[],[]]", "output": "[null, null, null, 2, 2, false]", "explanation": "MyStack myStack = new MyStack(); myStack.push(1); myStack.push(2); myStack.top(); // return 2; myStack.pop(); // return 2; myStack.empty(); // return false"}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/implement-stack-using-queues/', ARRAY['striver-a-z']),

-- ========== HASH TABLE (Easy) ==========

('isomorphic-strings', 'Isomorphic Strings', 'Given two strings s and t, determine if they are isomorphic.

Two strings s and t are isomorphic if the characters in s can be replaced to get t.

All occurrences of a character must be replaced with another character while preserving the order of characters. No two characters may map to the same character, but a character may map to itself.

Constraints:
- 1 <= s.length <= 5 * 10^4
- t.length == s.length
- s and t consist of any valid ascii character.', 'easy', ARRAY['hash-table', 'string'], ARRAY['Need two hash maps: one for s->t mapping, one for t->s mapping', 'Ensure bijection (one-to-one mapping)', 'Check that s[i] always maps to t[i] and vice versa', 'Both mappings must be consistent'], '[{"input": "s = \"egg\", t = \"add\"", "output": "true", "explanation": "e->a, g->d forms a valid isomorphic mapping."}, {"input": "s = \"foo\", t = \"bar\"", "output": "false", "explanation": "o cannot map to both a and r."}, {"input": "s = \"paper\", t = \"title\"", "output": "true", "explanation": "p->t, a->i, e->l, r->e forms valid mapping."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/isomorphic-strings/', ARRAY['striver-a-z']),

('word-pattern', 'Word Pattern', 'Given a pattern and a string s, find if s follows the same pattern.

Here follow means a full match, such that there is a bijection between a letter in pattern and a non-empty word in s.

Constraints:
- 1 <= pattern.length <= 300
- pattern contains only lower-case English letters.
- 1 <= s.length <= 3000
- s contains only lowercase English letters and spaces '' ''.
- s does not contain any leading or trailing spaces.
- All the words in s are separated by a single space.', 'easy', ARRAY['hash-table', 'string'], ARRAY['Split s into words', 'Use two hash maps for bijection', 'Pattern length must equal number of words', 'Each pattern character must map to exactly one word and vice versa'], '[{"input": "pattern = \"abba\", s = \"dog cat cat dog\"", "output": "true", "explanation": "a->dog, b->cat forms valid bijection."}, {"input": "pattern = \"abba\", s = \"dog cat cat fish\"", "output": "false", "explanation": "a cannot map to both dog and fish."}, {"input": "pattern = \"aaaa\", s = \"dog cat cat dog\"", "output": "false", "explanation": "a cannot map to both dog and cat."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/word-pattern/', ARRAY['striver-a-z']),

('happy-number', 'Happy Number', 'Write an algorithm to determine if a number n is happy.

A happy number is a number defined by the following process:
- Starting with any positive integer, replace the number by the sum of the squares of its digits.
- Repeat the process until the number equals 1 (where it will stay), or it loops endlessly in a cycle which does not include 1.
- Those numbers for which this process ends in 1 are happy.

Return true if n is a happy number, and false if not.

Constraints:
- 1 <= n <= 2^31 - 1', 'easy', ARRAY['hash-table', 'math', 'two-pointers'], ARRAY['Use a hash set to detect cycles', 'If you see a number again, there''s a cycle', 'Alternative: use Floyd''s cycle detection (slow/fast pointers)', 'Calculate sum of squares of digits repeatedly'], '[{"input": "n = 19", "output": "true", "explanation": "1^2 + 9^2 = 82; 8^2 + 2^2 = 68; 6^2 + 8^2 = 100; 1^2 + 0^2 + 0^2 = 1"}, {"input": "n = 2", "output": "false", "explanation": "Eventually enters a cycle that doesn''t include 1."}]'::jsonb, 'O(log n)', 'O(log n)', 'https://leetcode.com/problems/happy-number/', ARRAY['neetcode-150', 'striver-a-z']),

('first-unique-character-in-a-string', 'First Unique Character in a String', 'Given a string s, find the first non-repeating character in it and return its index. If it does not exist, return -1.

Constraints:
- 1 <= s.length <= 10^5
- s consists of only lowercase English letters.', 'easy', ARRAY['hash-table', 'string', 'queue', 'counting'], ARRAY['Count frequency of each character using hash map', 'Iterate through string again to find first character with count 1', 'Can use array of size 26 for lowercase letters', 'Two-pass solution: first pass counts, second pass finds'], '[{"input": "s = \"leetcode\"", "output": "0", "explanation": "The character ''l'' appears only once at index 0."}, {"input": "s = \"loveleetcode\"", "output": "2", "explanation": "The character ''v'' appears only once at index 2."}, {"input": "s = \"aabb\"", "output": "-1", "explanation": "All characters appear more than once."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/first-unique-character-in-a-string/', ARRAY['neetcode-150', 'striver-a-z']),

('intersection-of-two-arrays', 'Intersection of Two Arrays', 'Given two integer arrays nums1 and nums2, return an array of their intersection. Each element in the result must be unique and you may return the result in any order.

Constraints:
- 1 <= nums1.length, nums2.length <= 1000
- 0 <= nums1[i], nums2[i] <= 1000', 'easy', ARRAY['array', 'hash-table', 'two-pointers', 'binary-search', 'sorting'], ARRAY['Use two sets to find intersection', 'Convert both arrays to sets and find common elements', 'Alternative: sort both and use two pointers', 'Or use set for one array and iterate through the other'], '[{"input": "nums1 = [1,2,2,1], nums2 = [2,2]", "output": "[2]", "explanation": "Only 2 is common and appears once in result."}, {"input": "nums1 = [4,9,5], nums2 = [9,4,9,8,4]", "output": "[9,4]", "explanation": "Both 4 and 9 appear in both arrays."}]'::jsonb, 'O(n + m)', 'O(min(n, m))', 'https://leetcode.com/problems/intersection-of-two-arrays/', ARRAY['striver-a-z'])

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



-- Continuation: Greedy, DP, Medium/Hard problems

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== GREEDY & DYNAMIC PROGRAMMING (Easy/Medium) ==========

('assign-cookies', 'Assign Cookies', 'Assume you are an awesome parent and want to give your children some cookies. But, you should give each child at most one cookie.

Each child i has a greed factor g[i], which is the minimum size of a cookie that the child will be content with; and each cookie j has a size s[j]. If s[j] >= g[i], we can assign the cookie j to the child i, and the child i will be content. Your goal is to maximize the number of your content children and output the maximum number.

Constraints:
- 1 <= g.length <= 3 * 10^4
- 0 <= s.length <= 3 * 10^4
- 1 <= g[i], s[j] <= 2^31 - 1', 'easy', ARRAY['array', 'greedy', 'sorting', 'two-pointers'], ARRAY['Sort both greed factors and cookie sizes', 'Use greedy approach: assign smallest cookie that satisfies each child', 'Use two pointers to match cookies with children', 'Move to next child only when current child is satisfied'], '[{"input": "g = [1,2,3], s = [1,1]", "output": "1", "explanation": "You have 3 children and 2 cookies. The greed factors of 3 children are 1, 2, 3. Though you have 2 cookies, since their size is both 1, you could only make the child whose greed factor is 1 content."}, {"input": "g = [1,2], s = [1,2,3]", "output": "2", "explanation": "You have 2 children and 3 cookies. The greed factors of 2 children are 1, 2. You have 3 cookies and their sizes are big enough to gratify all of the children."}]'::jsonb, 'O(n log n)', 'O(1)', 'https://leetcode.com/problems/assign-cookies/', ARRAY['striver-a-z']),

('min-cost-climbing-stairs', 'Min Cost Climbing Stairs', 'You are given an integer array cost where cost[i] is the cost of ith step on a staircase. Once you pay the cost, you can either climb one or two steps.

You can either start from the step with index 0, or the step with index 1.

Return the minimum cost to reach the top of the floor.

Constraints:
- 2 <= cost.length <= 1000
- 0 <= cost[i] <= 999', 'easy', ARRAY['array', 'dynamic-programming'], ARRAY['Use DP where dp[i] = minimum cost to reach step i', 'dp[i] = cost[i] + min(dp[i-1], dp[i-2])', 'Can start from step 0 or step 1 (both have 0 initial cost)', 'Answer is min of reaching last two steps'], '[{"input": "cost = [10,15,20]", "output": "15", "explanation": "You will start at index 1. Pay 15 and climb two steps to reach the top. Total cost is 15."}, {"input": "cost = [1,100,1,1,1,100,1,1,100,1]", "output": "6", "explanation": "You will start at index 0. Pay 1 and climb two steps to reach index 2. Pay 1 and climb two steps to reach index 4. Pay 1 and climb two steps to reach index 6. Pay 1 and climb one step to reach index 7. Pay 1 and climb two steps to reach index 9. Pay 1 and climb one step to reach the top. Total is 6."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/min-cost-climbing-stairs/', ARRAY['neetcode-150', 'striver-a-z']),

('divisor-game', 'Divisor Game', 'Alice and Bob take turns playing a game, with Alice starting first.

Initially, there is a number n on the chalkboard. On each player''s turn, that player makes a move consisting of:
- Choosing any x with 0 < x < n and n % x == 0.
- Replacing the number n on the chalkboard with n - x.

Also, if a player cannot make a move, they lose the game.

Return true if and only if Alice wins the game, assuming both players play optimally.

Constraints:
- 1 <= n <= 1000', 'easy', ARRAY['math', 'dynamic-programming', 'brainteaser', 'game-theory'], ARRAY['This is a game theory problem with a simple pattern', 'Alice wins if n is even, loses if n is odd', 'If Alice gets an even number, she can always force Bob to get odd', 'DP approach: dp[i] = true if current player wins with number i'], '[{"input": "n = 2", "output": "true", "explanation": "Alice chooses 1, and Bob has no valid moves."}, {"input": "n = 3", "output": "false", "explanation": "Alice chooses 1, Bob gets 2 and wins."}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/divisor-game/', ARRAY['striver-a-z']),

('fibonacci-number', 'Fibonacci Number', 'The Fibonacci numbers, commonly denoted F(n) form a sequence, called the Fibonacci sequence, such that each number is the sum of the two preceding ones, starting from 0 and 1. That is,

F(0) = 0, F(1) = 1
F(n) = F(n - 1) + F(n - 2), for n > 1.

Given n, calculate F(n).

Constraints:
- 0 <= n <= 30', 'easy', ARRAY['math', 'dynamic-programming', 'recursion', 'memoization'], ARRAY['Use dynamic programming to avoid recalculating', 'Can optimize to O(1) space by keeping only last two values', 'Iterative approach: a, b = b, a+b', 'Matrix exponentiation for O(log n) solution'], '[{"input": "n = 2", "output": "1", "explanation": "F(2) = F(1) + F(0) = 1 + 0 = 1."}, {"input": "n = 3", "output": "2", "explanation": "F(3) = F(2) + F(1) = 1 + 1 = 2."}, {"input": "n = 4", "output": "3", "explanation": "F(4) = F(3) + F(2) = 2 + 1 = 3."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/fibonacci-number/', ARRAY['striver-a-z']),

('range-sum-query-immutable', 'Range Sum Query - Immutable', 'Given an integer array nums, handle multiple queries of the following type:

Calculate the sum of the elements of nums between indices left and right inclusive where left <= right.

Implement the NumArray class:
- NumArray(int[] nums) Initializes the object with the integer array nums.
- int sumRange(int left, int right) Returns the sum of the elements of nums between indices left and right inclusive (i.e., nums[left] + nums[left + 1] + ... + nums[right]).

Constraints:
- 1 <= nums.length <= 10^4
- -10^5 <= nums[i] <= 10^5
- 0 <= left <= right < nums.length
- At most 10^4 calls will be made to sumRange.', 'easy', ARRAY['array', 'design', 'prefix-sum'], ARRAY['Precompute prefix sums during initialization', 'prefix[i] = sum of elements from 0 to i', 'sumRange(left, right) = prefix[right+1] - prefix[left]', 'Use extra space for O(1) query time'], '[{"input": "[\"NumArray\", \"sumRange\", \"sumRange\", \"sumRange\"][[[-2, 0, 3, -5, 2, -1]], [0, 2], [2, 5], [0, 5]]", "output": "[null, 1, -1, -3]", "explanation": "NumArray numArray = new NumArray([-2, 0, 3, -5, 2, -1]); numArray.sumRange(0, 2); // return (-2) + 0 + 3 = 1; numArray.sumRange(2, 5); // return 3 + (-5) + 2 + (-1) = -1; numArray.sumRange(0, 5); // return (-2) + 0 + 3 + (-5) + 2 + (-1) = -3"}]'::jsonb, 'O(1) query', 'O(n)', 'https://leetcode.com/problems/range-sum-query-immutable/', ARRAY['striver-a-z']),

-- ========== MEDIUM ARRAYS & MATRIX ==========

('rotate-image', 'Rotate Image', 'You are given an n x n 2D matrix representing an image, rotate the image by 90 degrees (clockwise).

You have to rotate the image in-place, which means you have to modify the input 2D matrix directly. DO NOT allocate another 2D matrix and do the rotation.

Constraints:
- n == matrix.length == matrix[i].length
- 1 <= n <= 20
- -1000 <= matrix[i][j] <= 1000', 'medium', ARRAY['array', 'math', 'matrix'], ARRAY['Transpose the matrix first (swap matrix[i][j] with matrix[j][i])', 'Then reverse each row', 'Alternative: rotate layer by layer from outside to inside', 'For transpose: only process upper triangle to avoid double swap'], '[{"input": "matrix = [[1,2,3],[4,5,6],[7,8,9]]", "output": "[[7,4,1],[8,5,2],[9,6,3]]", "explanation": "Rotate the matrix 90 degrees clockwise."}, {"input": "matrix = [[5,1,9,11],[2,4,8,10],[13,3,6,7],[15,14,12,16]]", "output": "[[15,13,2,5],[14,3,4,1],[12,6,8,9],[16,7,10,11]]", "explanation": "4x4 matrix rotated 90 degrees clockwise."}]'::jsonb, 'O(n^2)', 'O(1)', 'https://leetcode.com/problems/rotate-image/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('spiral-matrix', 'Spiral Matrix', 'Given an m x n matrix, return all elements of the matrix in spiral order.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 10
- -100 <= matrix[i][j] <= 100', 'medium', ARRAY['array', 'matrix', 'simulation'], ARRAY['Maintain four boundaries: top, bottom, left, right', 'Traverse right, then down, then left, then up', 'Shrink boundaries after each direction', 'Continue until boundaries cross'], '[{"input": "matrix = [[1,2,3],[4,5,6],[7,8,9]]", "output": "[1,2,3,6,9,8,7,4,5]", "explanation": "Traverse the matrix in spiral order."}, {"input": "matrix = [[1,2,3,4],[5,6,7,8],[9,10,11,12]]", "output": "[1,2,3,4,8,12,11,10,9,5,6,7]", "explanation": "Spiral traversal of 3x4 matrix."}]'::jsonb, 'O(m * n)', 'O(1)', 'https://leetcode.com/problems/spiral-matrix/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('set-matrix-zeroes', 'Set Matrix Zeroes', 'Given an m x n integer matrix matrix, if an element is 0, set its entire row and column to 0''s.

You must do it in place.

Constraints:
- m == matrix.length
- n == matrix[0].length
- 1 <= m, n <= 200
- -2^31 <= matrix[i][j] <= 2^31 - 1

Follow-up:
- A straightforward solution using O(mn) space is probably a bad idea.
- A simple improvement uses O(m + n) space, but still not the best solution.
- Could you devise a constant space solution?', 'medium', ARRAY['array', 'hash-table', 'matrix'], ARRAY['Use first row and first column as markers', 'Track separately if first row/column need to be zeroed', 'Mark zeros in first row/col, then use those markers to zero the matrix', 'Process first row and column last'], '[{"input": "matrix = [[1,1,1],[1,0,1],[1,1,1]]", "output": "[[1,0,1],[0,0,0],[1,0,1]]", "explanation": "The element at (1,1) is 0, so row 1 and column 1 are set to 0."}, {"input": "matrix = [[0,1,2,0],[3,4,5,2],[1,3,1,5]]", "output": "[[0,0,0,0],[0,4,5,0],[0,3,1,0]]", "explanation": "Elements at (0,0) and (0,3) are 0."}]'::jsonb, 'O(m * n)', 'O(1)', 'https://leetcode.com/problems/set-matrix-zeroes/', ARRAY['blind-75', 'striver-a-z']),

-- ========== GRAPHS & BFS/DFS (Medium) ==========

('surrounded-regions', 'Surrounded Regions', 'Given an m x n matrix board containing ''X'' and ''O'', capture all regions that are 4-directionally surrounded by ''X''.

A region is captured by flipping all ''O''s into ''X''s in that surrounded region.

Constraints:
- m == board.length
- n == board[i].length
- 1 <= m, n <= 200
- board[i][j] is ''X'' or ''O''.', 'medium', ARRAY['array', 'matrix', 'depth-first-search', 'breadth-first-search', 'union-find'], ARRAY['Start DFS/BFS from ''O'' cells on the borders', 'Mark all border-connected ''O''s as safe (temporarily mark as different char)', 'After marking safe regions, flip all remaining ''O''s to ''X''', 'Finally, restore safe ''O''s from temporary marker'], '[{"input": "board = [[\"X\",\"X\",\"X\",\"X\"],[\"X\",\"O\",\"O\",\"X\"],[\"X\",\"X\",\"O\",\"X\"],[\"X\",\"O\",\"X\",\"X\"]]", "output": "[[\"X\",\"X\",\"X\",\"X\"],[\"X\",\"X\",\"X\",\"X\"],[\"X\",\"X\",\"X\",\"X\"],[\"X\",\"O\",\"X\",\"X\"]]", "explanation": "The ''O'' at (1,1) and (2,2) are surrounded and captured. The ''O'' at (3,1) is on the border."}, {"input": "board = [[\"X\"]]", "output": "[[\"X\"]]", "explanation": "Single cell, no regions to capture."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/surrounded-regions/', ARRAY['neetcode-150', 'striver-a-z']),

('redundant-connection', 'Redundant Connection', 'In this problem, a tree is an undirected graph that is connected and has no cycles.

You are given a graph that started as a tree with n nodes labeled from 1 to n, with one additional edge added. The added edge has two different vertices chosen from 1 to n, and was not an edge that already existed. The graph is represented as an array edges of length n where edges[i] = [ai, bi] indicates that there is an edge between nodes ai and bi in the graph.

Return an edge that can be removed so that the resulting graph is a tree of n nodes. If there are multiple answers, return the answer that occurs last in the input.

Constraints:
- n == edges.length
- 3 <= n <= 1000
- edges[i].length == 2
- 1 <= ai < bi <= edges.length
- ai != bi
- There are no repeated edges.
- The given graph is connected.', 'medium', ARRAY['graph', 'depth-first-search', 'breadth-first-search', 'union-find'], ARRAY['Use Union-Find (Disjoint Set Union) data structure', 'For each edge, check if both nodes are already connected', 'If they are in the same set, this edge creates a cycle', 'Return the first edge that creates a cycle'], '[{"input": "edges = [[1,2],[1,3],[2,3]]", "output": "[2,3]", "explanation": "The edge [2,3] creates a cycle, so removing it leaves a valid tree."}, {"input": "edges = [[1,2],[2,3],[3,4],[1,4],[1,5]]", "output": "[1,4]", "explanation": "Edge [1,4] is the last edge that creates a cycle."}]'::jsonb, 'O(n * α(n))', 'O(n)', 'https://leetcode.com/problems/redundant-connection/', ARRAY['neetcode-150', 'striver-a-z']),

('rotting-oranges', 'Rotting Oranges', 'You are given an m x n grid where each cell can have one of three values:
- 0 representing an empty cell,
- 1 representing a fresh orange, or
- 2 representing a rotten orange.

Every minute, any fresh orange that is 4-directionally adjacent to a rotten orange becomes rotten.

Return the minimum number of minutes that must elapse until no cell has a fresh orange. If this is impossible, return -1.

Constraints:
- m == grid.length
- n == grid[i].length
- 1 <= m, n <= 10
- grid[i][j] is 0, 1, or 2.', 'medium', ARRAY['array', 'matrix', 'breadth-first-search'], ARRAY['Use BFS starting with all initially rotten oranges in queue', 'Count fresh oranges initially', 'For each minute (BFS level), rot adjacent fresh oranges', 'If fresh oranges remain after BFS completes, return -1'], '[{"input": "grid = [[2,1,1],[1,1,0],[0,1,1]]", "output": "4", "explanation": "At minute 0: rotten at (0,0). At minute 1: (0,1) and (1,0) rot. At minute 2: (0,2) and (1,1) rot. At minute 3: (2,1) rots. At minute 4: (2,2) rots."}, {"input": "grid = [[2,1,1],[0,1,1],[1,0,1]]", "output": "-1", "explanation": "The orange in the bottom left corner will never rot."}, {"input": "grid = [[0,2]]", "output": "0", "explanation": "No fresh oranges, so answer is 0."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/rotting-oranges/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== STACK & MONOTONIC STACK (Medium) ==========

('simplify-path', 'Simplify Path', 'Given a string path, which is an absolute path (starting with a slash ''/'') to a file or directory in a Unix-style file system, convert it to the simplified canonical path.

In a Unix-style file system, a period ''.'' refers to the current directory, a double period ''..'' refers to the directory up a level, and any multiple consecutive slashes (i.e. ''//'' or ''///'') are treated as a single slash ''/''. For this problem, any other format of periods such as ''...'' are treated as file/directory names.

The canonical path should have the following format:
- The path starts with a single slash ''/''.
- Any two directories are separated by a single slash ''/''.
- The path does not end with a trailing ''/''.
- The path only contains the directories on the path from the root directory to the target file or directory (i.e., no period ''.'' or double period ''..'')

Return the simplified canonical path.

Constraints:
- 1 <= path.length <= 3000
- path consists of English letters, digits, period ''.'', slash ''/'' or ''_''.
- path is a valid absolute Unix path.', 'medium', ARRAY['string', 'stack'], ARRAY['Split the path by ''/'' to get components', 'Use a stack to track directory names', 'For "..": pop from stack if not empty', 'For ".": ignore; for empty: ignore; otherwise: push to stack'], '[{"input": "path = \"/home/\"", "output": "\"/home\"", "explanation": "Remove trailing slash."}, {"input": "path = \"/../\"", "output": "\"/\"", "explanation": "Going up from root stays at root."}, {"input": "path = \"/home//foo/\"", "output": "\"/home/foo\"", "explanation": "Multiple slashes treated as single slash."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/simplify-path/', ARRAY['striver-a-z']),

('asteroid-collision', 'Asteroid Collision', 'We are given an array asteroids of integers representing asteroids in a row.

For each asteroid, the absolute value represents its size, and the sign represents its direction (positive meaning right, negative meaning left). Each asteroid moves at the same speed.

Find out the state of the asteroids after all collisions. If two asteroids meet, the smaller one will explode. If both are the same size, both will explode. Two asteroids moving in the same direction will never meet.

Constraints:
- 2 <= asteroids.length <= 10^4
- -1000 <= asteroids[i] <= 1000
- asteroids[i] != 0', 'medium', ARRAY['array', 'stack'], ARRAY['Use a stack to simulate collisions', 'Collision only happens when stack top is positive and current is negative', 'Compare absolute values to determine which asteroid survives', 'Keep checking for collisions until no more possible'], '[{"input": "asteroids = [5,10,-5]", "output": "[5,10]", "explanation": "The 10 and -5 collide resulting in 10. The 5 and 10 never collide."}, {"input": "asteroids = [8,-8]", "output": "[]", "explanation": "The 8 and -8 collide exploding each other."}, {"input": "asteroids = [10,2,-5]", "output": "[10]", "explanation": "The 2 and -5 collide resulting in -5. The 10 and -5 collide resulting in 10."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/asteroid-collision/', ARRAY['striver-a-z']),

-- ========== BINARY SEARCH (Medium) ==========

('find-minimum-in-rotated-sorted-array', 'Find Minimum in Rotated Sorted Array', 'Suppose an array of length n sorted in ascending order is rotated between 1 and n times. For example, the array nums = [0,1,2,4,5,6,7] might become:
- [4,5,6,7,0,1,2] if it was rotated 4 times.
- [0,1,2,4,5,6,7] if it was rotated 7 times.

Notice that rotating an array [a[0], a[1], a[2], ..., a[n-1]] 1 time results in the array [a[n-1], a[0], a[1], a[2], ..., a[n-2]].

Given the sorted rotated array nums of unique elements, return the minimum element of this array.

You must write an algorithm that runs in O(log n) time.

Constraints:
- n == nums.length
- 1 <= n <= 5000
- -5000 <= nums[i] <= 5000
- All the integers of nums are unique.
- nums is sorted and rotated between 1 and n times.', 'medium', ARRAY['array', 'binary-search'], ARRAY['Use binary search to find the pivot point', 'If nums[mid] > nums[right], minimum is in right half', 'Otherwise, minimum is in left half (including mid)', 'The inflection point is the minimum'], '[{"input": "nums = [3,4,5,1,2]", "output": "1", "explanation": "The original array was [1,2,3,4,5] rotated 3 times."}, {"input": "nums = [4,5,6,7,0,1,2]", "output": "0", "explanation": "The original array was [0,1,2,4,5,6,7] rotated 4 times."}, {"input": "nums = [11,13,15,17]", "output": "11", "explanation": "The array is not rotated."}]'::jsonb, 'O(log n)', 'O(1)', 'https://leetcode.com/problems/find-minimum-in-rotated-sorted-array/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('search-in-rotated-sorted-array-ii', 'Search in Rotated Sorted Array II', 'There is an integer array nums sorted in non-decreasing order (not necessarily with distinct values).

Before being passed to your function, nums is rotated at an unknown pivot index k (0 <= k < nums.length) such that the resulting array is [nums[k], nums[k+1], ..., nums[n-1], nums[0], nums[1], ..., nums[k-1]] (0-indexed). For example, [0,1,2,4,4,4,5,6,6,7] might be rotated at pivot index 5 and become [4,5,6,6,7,0,1,2,4,4].

Given the array nums after the rotation and an integer target, return true if target is in nums, or false if it is not in nums.

You must decrease the overall operation steps as much as possible.

Constraints:
- 1 <= nums.length <= 5000
- -10^4 <= nums[i] <= 10^4
- nums is guaranteed to be rotated at some pivot.
- -10^4 <= target <= 10^4

Follow-up: This problem is similar to Search in Rotated Sorted Array, but nums may contain duplicates. Would this affect the runtime complexity? How and why?', 'medium', ARRAY['array', 'binary-search'], ARRAY['Similar to Search in Rotated Sorted Array but with duplicates', 'When nums[left] == nums[mid], cannot determine which half is sorted', 'In this case, increment left pointer by 1', 'Worst case becomes O(n) due to duplicates'], '[{"input": "nums = [2,5,6,0,0,1,2], target = 0", "output": "true", "explanation": "0 exists in the array."}, {"input": "nums = [2,5,6,0,0,1,2], target = 3", "output": "false", "explanation": "3 does not exist in the array."}]'::jsonb, 'O(n) worst case', 'O(1)', 'https://leetcode.com/problems/search-in-rotated-sorted-array-ii/', ARRAY['striver-a-z'])

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



-- Final Batch: Hard Problems and Remaining Medium/Hard Topics

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== DYNAMIC PROGRAMMING (Medium/Hard) ==========

('house-robber-ii', 'House Robber II', 'You are a professional robber planning to rob houses along a street. Each house has a certain amount of money stashed. All houses at this place are arranged in a circle. That means the first house is the neighbor of the last one. Meanwhile, adjacent houses have a security system connected, and it will automatically contact the police if two adjacent houses were broken into on the same night.

Given an integer array nums representing the amount of money of each house, return the maximum amount of money you can rob tonight without alerting the police.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 1000', 'medium', ARRAY['array', 'dynamic-programming'], ARRAY['Since houses are in a circle, you cannot rob both first and last house', 'Break into two subproblems: rob houses [0..n-2] OR rob houses [1..n-1]', 'Apply House Robber I solution to both ranges', 'Return the maximum of both solutions'], '[{"input": "nums = [2,3,2]", "output": "3", "explanation": "You cannot rob house 1 (money = 2) and then rob house 3 (money = 2), because they are adjacent. Rob house 2 (money = 3) instead."}, {"input": "nums = [1,2,3,1]", "output": "4", "explanation": "Rob house 1 (money = 1) and then rob house 3 (money = 3). Total = 1 + 3 = 4."}, {"input": "nums = [1,2,3]", "output": "3", "explanation": "Rob house 3 (money = 3)."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/house-robber-ii/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('palindromic-substrings', 'Palindromic Substrings', 'Given a string s, return the number of palindromic substrings in it.

A string is a palindrome when it reads the same backward as forward.

A substring is a contiguous sequence of characters within the string.

Constraints:
- 1 <= s.length <= 1000
- s consists of lowercase English letters.', 'medium', ARRAY['string', 'dynamic-programming'], ARRAY['Expand around center approach for each possible center', 'For each position, check both odd-length (single center) and even-length (two centers)', 'Count total palindromes found', 'Alternative: use 2D DP where dp[i][j] = is s[i..j] palindrome'], '[{"input": "s = \"abc\"", "output": "3", "explanation": "Three palindromic substrings: \"a\", \"b\", \"c\"."}, {"input": "s = \"aaa\"", "output": "6", "explanation": "Six palindromic substrings: \"a\", \"a\", \"a\", \"aa\", \"aa\", \"aaa\"."}]'::jsonb, 'O(n^2)', 'O(1)', 'https://leetcode.com/problems/palindromic-substrings/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('partition-equal-subset-sum', 'Partition Equal Subset Sum', 'Given an integer array nums, return true if you can partition the array into two subsets such that the sum of the elements in both subsets is equal or false otherwise.

Constraints:
- 1 <= nums.length <= 200
- 1 <= nums[i] <= 100', 'medium', ARRAY['array', 'dynamic-programming'], ARRAY['First check if total sum is even (if odd, impossible)', 'Target is sum / 2', 'This becomes 0/1 Knapsack: can we make sum = target?', 'Use DP where dp[i] = can we make sum i'], '[{"input": "nums = [1,5,11,5]", "output": "true", "explanation": "The array can be partitioned as [1, 5, 5] and [11]."}, {"input": "nums = [1,2,3,5]", "output": "false", "explanation": "The array cannot be partitioned into equal sum subsets."}]'::jsonb, 'O(n * sum)', 'O(sum)', 'https://leetcode.com/problems/partition-equal-subset-sum/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== TWO POINTERS & SLIDING WINDOW (Medium) ==========

('minimum-size-subarray-sum', 'Minimum Size Subarray Sum', 'Given an array of positive integers nums and a positive integer target, return the minimal length of a subarray whose sum is greater than or equal to target. If there is no such subarray, return 0 instead.

Constraints:
- 1 <= target <= 10^9
- 1 <= nums.length <= 10^5
- 1 <= nums[i] <= 10^4

Follow-up: If you have figured out the O(n) solution, try coding another solution of which the time complexity is O(n log(n)).', 'medium', ARRAY['array', 'binary-search', 'sliding-window', 'prefix-sum'], ARRAY['Use sliding window with two pointers', 'Expand window by adding right elements', 'Contract window from left while sum >= target', 'Track minimum window size'], '[{"input": "target = 7, nums = [2,3,1,2,4,3]", "output": "2", "explanation": "The subarray [4,3] has the minimal length under the problem constraint."}, {"input": "target = 4, nums = [1,4,4]", "output": "1", "explanation": "The subarray [4] has the minimal length."}, {"input": "target = 11, nums = [1,1,1,1,1,1,1,1]", "output": "0", "explanation": "No subarray sums to 11."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/minimum-size-subarray-sum/', ARRAY['striver-a-z']),

('gas-station', 'Gas Station', 'There are n gas stations along a circular route, where the amount of gas at the ith station is gas[i].

You have a car with an unlimited gas tank and it costs cost[i] of gas to travel from the ith station to its next (i + 1)th station. You begin the journey with an empty tank at one of the gas stations.

Given two integer arrays gas and cost, return the starting gas station''s index if you can travel around the circuit once in the clockwise direction, otherwise return -1. If there exists a solution, it is guaranteed to be unique.

Constraints:
- n == gas.length == cost.length
- 1 <= n <= 10^5
- 0 <= gas[i], cost[i] <= 10^4', 'medium', ARRAY['array', 'greedy'], ARRAY['If total gas < total cost, impossible to complete circuit', 'Keep track of current tank; if it goes negative, reset start to next station', 'The key insight: if you can''t reach station j from i, you can''t reach it from any station between i and j', 'Start from index where tank first becomes non-negative'], '[{"input": "gas = [1,2,3,4,5], cost = [3,4,5,1,2]", "output": "3", "explanation": "Start at station 3 (index 3) and fill with 4 gas. Travel to station 4 costs 1, arrive with 3 gas. Fill with 5, now have 8. Travel to station 0 costs 2, arrive with 6. Continue around circuit."}, {"input": "gas = [2,3,4], cost = [3,4,3]", "output": "-1", "explanation": "Cannot start at any station to complete the circuit."}]'::jsonb, 'O(n)', 'O(1)', 'https://leetcode.com/problems/gas-station/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== MATH & BIT MANIPULATION (Medium) ==========

('powx-n', 'Pow(x, n)', 'Implement pow(x, n), which calculates x raised to the power n (i.e., x^n).

Constraints:
- -100.0 < x < 100.0
- -2^31 <= n <= 2^31-1
- n is an integer.
- Either x is not zero or n > 0.
- -10^4 <= x^n <= 10^4', 'medium', ARRAY['math', 'recursion'], ARRAY['Use binary exponentiation (divide and conquer)', 'x^n = (x^(n/2))^2 for even n', 'x^n = x * (x^(n/2))^2 for odd n', 'Handle negative exponents: x^(-n) = 1 / x^n'], '[{"input": "x = 2.00000, n = 10", "output": "1024.00000", "explanation": "2^10 = 1024"}, {"input": "x = 2.10000, n = 3", "output": "9.26100", "explanation": "2.1^3 = 9.261"}, {"input": "x = 2.00000, n = -2", "output": "0.25000", "explanation": "2^(-2) = 1/(2^2) = 1/4 = 0.25"}]'::jsonb, 'O(log n)', 'O(log n)', 'https://leetcode.com/problems/powx-n/', ARRAY['striver-a-z']),

('sum-of-two-integers', 'Sum of Two Integers', 'Given two integers a and b, return the sum of the two integers without using the operators + and -.

Constraints:
- -1000 <= a, b <= 1000', 'medium', ARRAY['math', 'bit-manipulation'], ARRAY['Use XOR (^) for addition without carry', 'Use AND (&) shifted left by 1 to find carry', 'Repeat until carry is 0', 'Handle negative numbers carefully'], '[{"input": "a = 1, b = 2", "output": "3", "explanation": "1 + 2 = 3"}, {"input": "a = 2, b = 3", "output": "5", "explanation": "2 + 3 = 5"}]'::jsonb, 'O(1)', 'O(1)', 'https://leetcode.com/problems/sum-of-two-integers/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BACKTRACKING (Medium) ==========

('subsets-ii', 'Subsets II', 'Given an integer array nums that may contain duplicates, return all possible subsets (the power set).

The solution set must not contain duplicate subsets. Return the solution in any order.

Constraints:
- 1 <= nums.length <= 10
- -10 <= nums[i] <= 10', 'medium', ARRAY['array', 'backtracking', 'bit-manipulation'], ARRAY['Sort the array first to handle duplicates', 'Use backtracking similar to Subsets I', 'Skip duplicate elements at the same recursion level', 'When choosing to skip an element, skip all its duplicates'], '[{"input": "nums = [1,2,2]", "output": "[[],[1],[1,2],[1,2,2],[2],[2,2]]", "explanation": "All unique subsets including duplicates handled."}, {"input": "nums = [0]", "output": "[[],[0]]", "explanation": "Two subsets: empty and single element."}]'::jsonb, 'O(n * 2^n)', 'O(n)', 'https://leetcode.com/problems/subsets-ii/', ARRAY['neetcode-150', 'striver-a-z']),

('combination-sum-ii', 'Combination Sum II', 'Given a collection of candidate numbers (candidates) and a target number (target), find all unique combinations in candidates where the candidate numbers sum to target.

Each number in candidates may only be used once in the combination.

Note: The solution set must not contain duplicate combinations.

Constraints:
- 1 <= candidates.length <= 100
- 1 <= candidates[i] <= 50
- 1 <= target <= 30', 'medium', ARRAY['array', 'backtracking'], ARRAY['Sort the array to handle duplicates', 'Each element can be used only once, so increment index in recursion', 'Skip duplicates at same recursion level', 'If candidates[i] == candidates[i-1] at same level, skip'], '[{"input": "candidates = [10,1,2,7,6,1,5], target = 8", "output": "[[1,1,6],[1,2,5],[1,7],[2,6]]", "explanation": "All unique combinations that sum to 8."}, {"input": "candidates = [2,5,2,1,2], target = 5", "output": "[[1,2,2],[5]]", "explanation": "Duplicates handled properly."}]'::jsonb, 'O(2^n)', 'O(n)', 'https://leetcode.com/problems/combination-sum-ii/', ARRAY['striver-a-z']),

('letter-combinations-of-a-phone-number', 'Letter Combinations of a Phone Number', 'Given a string containing digits from 2-9 inclusive, return all possible letter combinations that the number could represent. Return the answer in any order.

A mapping of digits to letters (just like on the telephone buttons) is given below. Note that 1 does not map to any letters.

2: abc
3: def
4: ghi
5: jkl
6: mno
7: pqrs
8: tuv
9: wxyz

Constraints:
- 0 <= digits.length <= 4
- digits[i] is a digit in the range [''2'', ''9''].', 'medium', ARRAY['hash-table', 'string', 'backtracking'], ARRAY['Create a mapping from digit to letters', 'Use backtracking to build combinations', 'For each digit, try all possible letters', 'Recursion depth equals digits.length'], '[{"input": "digits = \"23\"", "output": "[\"ad\",\"ae\",\"af\",\"bd\",\"be\",\"bf\",\"cd\",\"ce\",\"cf\"]", "explanation": "All possible combinations of letters from digits 2 and 3."}, {"input": "digits = \"\"", "output": "[]", "explanation": "Empty input gives empty output."}, {"input": "digits = \"2\"", "output": "[\"a\",\"b\",\"c\"]", "explanation": "Only one digit maps to three letters."}]'::jsonb, 'O(4^n * n)', 'O(n)', 'https://leetcode.com/problems/letter-combinations-of-a-phone-number/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== HARD PROBLEMS ==========

('minimum-window-substring', 'Minimum Window Substring', 'Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t (including duplicates) is included in the window. If there is no such substring, return the empty string "".

The testcases will be generated such that the answer is unique.

Constraints:
- m == s.length
- n == t.length
- 1 <= m, n <= 10^5
- s and t consist of uppercase and lowercase English letters.

Follow-up: Could you find an algorithm that runs in O(m + n) time?', 'hard', ARRAY['hash-table', 'string', 'sliding-window'], ARRAY['Use sliding window with two pointers', 'Maintain frequency map of characters in t', 'Expand window until all characters are included', 'Contract from left to find minimum window'], '[{"input": "s = \"ADOBECODEBANC\", t = \"ABC\"", "output": "\"BANC\"", "explanation": "The minimum window substring \"BANC\" includes ''A'', ''B'', and ''C'' from string t."}, {"input": "s = \"a\", t = \"a\"", "output": "\"a\"", "explanation": "The entire string s is the minimum window."}, {"input": "s = \"a\", t = \"aa\"", "output": "\"\"", "explanation": "Both ''a''s from t must be included, but s only has one."}]'::jsonb, 'O(m + n)', 'O(k)', 'https://leetcode.com/problems/minimum-window-substring/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-valid-parentheses', 'Longest Valid Parentheses', 'Given a string containing just the characters ''('' and '')'', return the length of the longest valid (well-formed) parentheses substring.

Constraints:
- 0 <= s.length <= 3 * 10^4
- s[i] is ''('', or '')''.', 'hard', ARRAY['string', 'dynamic-programming', 'stack'], ARRAY['Use a stack to store indices', 'Push -1 initially to handle edge cases', 'For ''('': push index; for '')'': pop and calculate length', 'Alternative: DP approach where dp[i] = length of longest valid ending at i'], '[{"input": "s = \"(()\"", "output": "2", "explanation": "The longest valid parentheses substring is \"()\"."}, {"input": "s = \")()())\"", "output": "4", "explanation": "The longest valid parentheses substring is \"()()\"."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/longest-valid-parentheses/', ARRAY['striver-a-z']),

('binary-tree-maximum-path-sum', 'Binary Tree Maximum Path Sum', 'A path in a binary tree is a sequence of nodes where each pair of adjacent nodes in the sequence has an edge connecting them. A node can only appear in the sequence at most once. Note that the path does not need to pass through the root.

The path sum of a path is the sum of the node''s values in the path.

Given the root of a binary tree, return the maximum path sum of any non-empty path.

Constraints:
- The number of nodes in the tree is in the range [1, 3 * 10^4].
- -1000 <= Node.val <= 1000', 'hard', ARRAY['tree', 'depth-first-search', 'dynamic-programming', 'binary-tree'], ARRAY['At each node, calculate max gain from left and right subtrees', 'Global max = left_gain + right_gain + node.val', 'Return to parent: max(left_gain, right_gain) + node.val', 'Handle negative gains by taking max with 0'], '[{"input": "root = [1,2,3]", "output": "6", "explanation": "The optimal path is 2 -> 1 -> 3 with a path sum of 2 + 1 + 3 = 6."}, {"input": "root = [-10,9,20,null,null,15,7]", "output": "42", "explanation": "The optimal path is 15 -> 20 -> 7 with a path sum of 15 + 20 + 7 = 42."}]'::jsonb, 'O(n)', 'O(h)', 'https://leetcode.com/problems/binary-tree-maximum-path-sum/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('serialize-and-deserialize-binary-tree', 'Serialize and Deserialize Binary Tree', 'Serialization is the process of converting a data structure or object into a sequence of bits so that it can be stored in a file or memory buffer, or transmitted across a network connection link to be reconstructed later in the same or another computer environment.

Design an algorithm to serialize and deserialize a binary tree. There is no restriction on how your serialization/deserialization algorithm should work. You just need to ensure that a binary tree can be serialized to a string and this string can be deserialized to the original tree structure.

Clarification: The input/output format is the same as how LeetCode serializes a binary tree. You do not necessarily need to follow this format, so please be creative and come up with different approaches yourself.

Constraints:
- The number of nodes in the tree is in the range [0, 10^4].
- -1000 <= Node.val <= 1000', 'hard', ARRAY['string', 'tree', 'depth-first-search', 'breadth-first-search', 'design', 'binary-tree'], ARRAY['Use preorder traversal for serialization', 'Represent null nodes with a marker (e.g., "#" or "null")', 'Separate values with delimiter (e.g., ",")', 'For deserialization, parse values and reconstruct using same traversal order'], '[{"input": "root = [1,2,3,null,null,4,5]", "output": "[1,2,3,null,null,4,5]", "explanation": "The tree is serialized and then deserialized back to the same structure."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/serialize-and-deserialize-binary-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays.

The overall run time complexity should be O(log (m+n)).

Constraints:
- nums1.length == m
- nums2.length == n
- 0 <= m <= 1000
- 0 <= n <= 1000
- 1 <= m + n <= 2000
- -10^6 <= nums1[i], nums2[i] <= 10^6', 'hard', ARRAY['array', 'binary-search', 'divide-and-conquer'], ARRAY['Binary search on the smaller array', 'Partition both arrays such that left half has same size as right half', 'Ensure max(left) <= min(right) for both arrays', 'Median depends on whether total length is odd or even'], '[{"input": "nums1 = [1,3], nums2 = [2]", "output": "2.00000", "explanation": "merged array = [1,2,3] and median is 2."}, {"input": "nums1 = [1,2], nums2 = [3,4]", "output": "2.50000", "explanation": "merged array = [1,2,3,4] and median is (2 + 3) / 2 = 2.5."}]'::jsonb, 'O(log(min(m,n)))', 'O(1)', 'https://leetcode.com/problems/median-of-two-sorted-arrays/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('regular-expression-matching', 'Regular Expression Matching', 'Given an input string s and a pattern p, implement regular expression matching with support for ''.'' and ''*'' where:
- ''.'' Matches any single character.
- ''*'' Matches zero or more of the preceding element.

The matching should cover the entire input string (not partial).

Constraints:
- 1 <= s.length <= 20
- 1 <= p.length <= 20
- s contains only lowercase English letters.
- p contains only lowercase English letters, ''.'', and ''*''.
- It is guaranteed for each appearance of the character ''*'', there will be a previous valid character to match.', 'hard', ARRAY['string', 'dynamic-programming', 'recursion'], ARRAY['Use 2D DP where dp[i][j] = does s[0..i] match p[0..j]', 'Handle ''*'': try 0 occurrences or 1+ occurrences', 'For ''.'': match any character', 'Base case: empty string matches empty pattern'], '[{"input": "s = \"aa\", p = \"a\"", "output": "false", "explanation": "\"a\" does not match the entire string \"aa\"."}, {"input": "s = \"aa\", p = \"a*\"", "output": "true", "explanation": "''*'' means zero or more of the preceding element, ''a''. Therefore, by repeating ''a'' once, it becomes \"aa\"."}, {"input": "s = \"ab\", p = \".*\"", "output": "true", "explanation": "\".*\" means \"zero or more (*) of any character (.)\"."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/regular-expression-matching/', ARRAY['neetcode-150', 'striver-a-z']),

('wildcard-matching', 'Wildcard Matching', 'Given an input string (s) and a pattern (p), implement wildcard pattern matching with support for ''?'' and ''*'' where:
- ''?'' Matches any single character.
- ''*'' Matches any sequence of characters (including the empty sequence).

The matching should cover the entire input string (not partial).

Constraints:
- 0 <= s.length, p.length <= 2000
- s contains only lowercase English letters.
- p contains only lowercase English letters, ''?'' or ''*''.', 'hard', ARRAY['string', 'dynamic-programming', 'greedy', 'recursion'], ARRAY['Use 2D DP similar to regular expression matching', 'dp[i][j] = does s[0..i] match p[0..j]', 'For ''*'': try matching 0 characters or 1+ characters', 'For ''?'': match exactly one character'], '[{"input": "s = \"aa\", p = \"a\"", "output": "false", "explanation": "\"a\" does not match the entire string \"aa\"."}, {"input": "s = \"aa\", p = \"*\"", "output": "true", "explanation": "''*'' matches any sequence."}, {"input": "s = \"cb\", p = \"?a\"", "output": "false", "explanation": "''?'' matches ''c'', but second letter is ''b'' which doesn''t match ''a''."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/wildcard-matching/', ARRAY['striver-a-z']),

('merge-k-sorted-lists', 'Merge k Sorted Lists', 'You are given an array of k linked-lists lists, each linked-list is sorted in ascending order.

Merge all the linked-lists into one sorted linked-list and return it.

Constraints:
- k == lists.length
- 0 <= k <= 10^4
- 0 <= lists[i].length <= 500
- -10^4 <= lists[i][j] <= 10^4
- lists[i] is sorted in ascending order.
- The sum of lists[i].length will not exceed 10^4.', 'hard', ARRAY['linked-list', 'divide-and-conquer', 'heap', 'merge-sort'], ARRAY['Use a min-heap to track the smallest element across all lists', 'Always extract min from heap and add its next node', 'Alternative: divide and conquer - merge lists in pairs', 'Heap approach: O(N log k) where N is total nodes'], '[{"input": "lists = [[1,4,5],[1,3,4],[2,6]]", "output": "[1,1,2,3,4,4,5,6]", "explanation": "The linked-lists are merged into one sorted list."}, {"input": "lists = []", "output": "[]", "explanation": "No lists to merge."}, {"input": "lists = [[]]", "output": "[]", "explanation": "Single empty list."}]'::jsonb, 'O(N log k)', 'O(k)', 'https://leetcode.com/problems/merge-k-sorted-lists/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('largest-rectangle-in-histogram', 'Largest Rectangle in Histogram', 'Given an array of integers heights representing the histogram''s bar height where the width of each bar is 1, return the area of the largest rectangle in the histogram.

Constraints:
- 1 <= heights.length <= 10^5
- 0 <= heights[i] <= 10^4', 'hard', ARRAY['array', 'stack', 'monotonic-stack'], ARRAY['Use a monotonic increasing stack to store indices', 'When current bar is shorter than stack top, pop and calculate area', 'Area = heights[popped] * (current_index - stack.top() - 1)', 'Push -1 to stack initially to handle edge cases'], '[{"input": "heights = [2,1,5,6,2,3]", "output": "10", "explanation": "The rectangle with height 5 and width 2 (indices 2-3) has area 10."}, {"input": "heights = [2,4]", "output": "4", "explanation": "The largest rectangle has area 4."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/largest-rectangle-in-histogram/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('maximal-rectangle', 'Maximal Rectangle',
 'Given a rows x cols binary matrix filled with 0''s and 1''s, find the largest rectangle containing only 1''s and return its area.

Constraints:
- rows == matrix.length
- cols == matrix[i].length
- 1 <= rows, cols <= 200
- matrix[i][j] is ''0'' or ''1''.',
 'hard',
 ARRAY['array', 'dynamic-programming', 'stack', 'matrix', 'monotonic-stack'],
 ARRAY[
   'Treat each row as the base of a histogram',
   'For each row, calculate heights array where heights[j] = consecutive 1s above in column j',
   'Apply "Largest Rectangle in Histogram" for each row',
   'Track maximum area found'
 ],
 '[{"input": "matrix = [[\"1\",\"0\",\"1\",\"0\",\"0\"],[\"1\",\"0\",\"1\",\"1\",\"1\"],[\"1\",\"1\",\"1\",\"1\",\"1\"],[\"1\",\"0\",\"0\",\"1\",\"0\"]]", "output": "6", "explanation": "The maximal rectangle is formed by 1s at rows 1-2, columns 2-4."}]'::jsonb,
 'O(m * n)',
 'O(n)',
 'https://leetcode.com/problems/maximal-rectangle/',
 ARRAY['striver-a-z']
),

('burst-balloons', 'Burst Balloons', 'You are given n balloons, indexed from 0 to n - 1. Each balloon is painted with a number on it represented by an array nums. You are asked to burst all the balloons.

If you burst the ith balloon, you will get nums[i - 1] * nums[i] * nums[i + 1] coins. If i - 1 or i + 1 goes out of bounds of the array, then treat it as if there is a balloon with a 1 painted on it.

Return the maximum coins you can collect by bursting the balloons wisely.

Constraints:
- n == nums.length
- 1 <= n <= 300
- 0 <= nums[i] <= 100', 'hard', ARRAY['array', 'dynamic-programming'], ARRAY['Think backwards: which balloon to burst last in a range', 'Use interval DP: dp[i][j] = max coins from bursting balloons (i, j)', 'Add virtual balloons with value 1 at both ends', 'For each range, try all possible last balloons to burst'], '[{"input": "nums = [3,1,5,8]", "output": "167", "explanation": "Burst balloon at index 1 first to get 3*1*5 = 15 coins. Then burst at 0 to get 1*3*8 = 24. Then burst at 2 to get 1*5*8 = 40. Finally burst at 3 to get 1*8*1 = 8. Total = 15 + 24 + 40 + 8 + 80 (from bursting in optimal order) = 167."}, {"input": "nums = [1,5]", "output": "10", "explanation": "Burst balloon 0 then 1 for 1*1*5 + 1*5*1 = 10."}]'::jsonb, 'O(n^3)', 'O(n^2)', 'https://leetcode.com/problems/burst-balloons/', ARRAY['neetcode-150', 'striver-a-z'])

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



-- Final Hard Problems and Remaining Advanced Topics

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== MORE HARD PROBLEMS ==========

('palindrome-partitioning-ii', 'Palindrome Partitioning II', 'Given a string s, partition s such that every substring of the partition is a palindrome.

Return the minimum cuts needed for a palindrome partitioning of s.

Constraints:
- 1 <= s.length <= 2000
- s consists of lowercase English letters only.', 'hard', ARRAY['string', 'dynamic-programming'], ARRAY['Precompute which substrings are palindromes using 2D DP', 'Use 1D DP where dp[i] = min cuts needed for s[0..i]', 'If s[0..i] is palindrome, dp[i] = 0', 'Otherwise, dp[i] = min(dp[j] + 1) for all j where s[j+1..i] is palindrome'], '[{"input": "s = \"aab\"", "output": "1", "explanation": "The palindrome partitioning [\"aa\",\"b\"] could be produced using 1 cut."}, {"input": "s = \"a\"", "output": "0", "explanation": "No cuts needed for single character."}, {"input": "s = \"ab\"", "output": "1", "explanation": "One cut produces [\"a\",\"b\"]."}]'::jsonb, 'O(n^2)', 'O(n^2)', 'https://leetcode.com/problems/palindrome-partitioning-ii/', ARRAY['striver-a-z']),

('word-ladder', 'Word Ladder', 'A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that:
- Every adjacent pair of words differs by a single letter.
- Every si for 1 <= i <= k is in wordList. Note that beginWord does not need to be in wordList.
- sk == endWord

Given two words, beginWord and endWord, and a dictionary wordList, return the number of words in the shortest transformation sequence from beginWord to endWord, or 0 if no such sequence exists.

Constraints:
- 1 <= beginWord.length <= 10
- endWord.length == beginWord.length
- 1 <= wordList.length <= 5000
- wordList[i].length == beginWord.length
- beginWord, endWord, and wordList[i] consist of lowercase English letters.
- beginWord != endWord
- All the words in wordList are unique.', 'hard', ARRAY['hash-table', 'string', 'breadth-first-search'], ARRAY['Use BFS to find shortest path in unweighted graph', 'Each word is a node; edge exists if words differ by one letter', 'For each word, try changing each character to find neighbors', 'Use a set for O(1) dictionary lookup'], '[{"input": "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]", "output": "5", "explanation": "One shortest transformation sequence is \"hit\" -> \"hot\" -> \"dot\" -> \"dog\" -> \"cog\", which is 5 words long."}, {"input": "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\"]", "output": "0", "explanation": "The endWord \"cog\" is not in wordList, therefore there is no valid transformation sequence."}]'::jsonb, 'O(M^2 * N)', 'O(M^2 * N)', 'https://leetcode.com/problems/word-ladder/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('word-ladder-ii', 'Word Ladder II', 'A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words beginWord -> s1 -> s2 -> ... -> sk such that:
- Every adjacent pair of words differs by a single letter.
- Every si for 1 <= i <= k is in wordList. Note that beginWord does not need to be in wordList.
- sk == endWord

Given two words, beginWord and endWord, and a dictionary wordList, return all the shortest transformation sequences from beginWord to endWord, or an empty list if no such sequence exists. Each sequence should be returned as a list of the words [beginWord, s1, s2, ..., sk].

Constraints:
- 1 <= beginWord.length <= 5
- endWord.length == beginWord.length
- 1 <= wordList.length <= 500
- wordList[i].length == beginWord.length
- beginWord, endWord, and wordList[i] consist of lowercase English letters.
- beginWord != endWord
- All the words in wordList are unique.
- The sum of all shortest transformation sequences does not exceed 10^5.', 'hard', ARRAY['hash-table', 'string', 'backtracking', 'breadth-first-search'], ARRAY['Use BFS to find shortest distance to each word', 'Build a distance map during BFS', 'Use DFS/backtracking to reconstruct all shortest paths', 'Only follow edges that decrease distance by 1'], '[{"input": "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]", "output": "[[\"hit\",\"hot\",\"dot\",\"dog\",\"cog\"],[\"hit\",\"hot\",\"lot\",\"log\",\"cog\"]]", "explanation": "There are 2 shortest transformation sequences."}, {"input": "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\"]", "output": "[]", "explanation": "The endWord \"cog\" is not in wordList."}]'::jsonb, 'O(V + E)', 'O(V + E)', 'https://leetcode.com/problems/word-ladder-ii/', ARRAY['striver-a-z']),

('alien-dictionary', 'Alien Dictionary', 'There is a new alien language that uses the English alphabet. However, the order among the letters is unknown to you.

You are given a list of strings words from the alien language''s dictionary, where the strings in words are sorted lexicographically by the rules of this new language.

Return a string of the unique letters in the new alien language sorted in lexicographically increasing order by the new language''s rules. If there is no solution, return "". If there are multiple solutions, return any of them.

Constraints:
- 1 <= words.length <= 100
- 1 <= words[i].length <= 100
- words[i] consists of only lowercase English letters.', 'hard', ARRAY['array', 'string', 'graph', 'topological-sort', 'depth-first-search', 'breadth-first-search'], ARRAY['Build a directed graph by comparing adjacent words', 'Find first differing character between adjacent words to determine order', 'Use topological sort (Kahn''s algorithm or DFS) to find character order', 'Detect cycles - if cycle exists, no valid ordering'], '[{"input": "words = [\"wrt\",\"wrf\",\"er\",\"ett\",\"rftt\"]", "output": "\"wertf\"", "explanation": "From \"wrt\" and \"wrf\", we can derive ''t'' < ''f''. From \"wrf\" and \"er\", we can derive ''w'' < ''e''. From \"er\" and \"ett\", we can derive ''r'' < ''t''. From \"ett\" and \"rftt\", we can derive ''e'' < ''r''."}, {"input": "words = [\"z\",\"x\"]", "output": "\"zx\"", "explanation": "From \"z\" and \"x\", we can derive ''z'' < ''x''."}]'::jsonb, 'O(V + E)', 'O(V + E)', 'https://leetcode.com/problems/alien-dictionary/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('bus-routes', 'Bus Routes',
 'You are given an array routes where routes[i] is a bus route that the ith bus repeats forever.

Each route is a list of bus stops that the bus visits in order.

You start at the bus stop source and want to go to the bus stop target.

You can travel between bus stops by taking buses, but each time you take a bus, you must stay on it until you reach the next bus stop.

Return the least number of buses you must take to travel from source to target. Return -1 if it is not possible.

Constraints:
- 1 <= routes.length <= 500
- 1 <= routes[i].length <= 10^5
- 0 <= routes[i][j] < 10^6
- 0 <= source, target < 10^6',
 'hard',
 ARRAY['array', 'hash-table', 'breadth-first-search'],
 ARRAY[
   'Build a graph where nodes are bus routes',
   'Two routes are connected if they share a common stop',
   'Use BFS to find shortest path between routes containing source and target',
   'Map each stop to all routes that pass through it'
 ],
 '[{"input": "routes = [[1,2,7],[3,6,7]], source = 1, target = 6", "output": "2", "explanation": "Take the first bus to stop 7, then take the second bus to stop 6."}, {"input": "routes = [[7,12],[4,5,15],[6],[15,19],[9,12,13]], source = 15, target = 12", "output": "-1", "explanation": "It is not possible to go from source to target."}]'::jsonb,
 'O(V + E)',
 'O(V + E)',
 'https://leetcode.com/problems/bus-routes/',
 ARRAY['grind-75']
),

('find-median-from-data-stream', 'Find Median from Data Stream', 'The median is the middle value in an ordered integer list. If the size of the list is even, there is no middle value, and the median is the mean of the two middle values.

For example, for arr = [2,3,4], the median is 3.
For example, for arr = [2,3], the median is (2 + 3) / 2 = 2.5.

Implement the MedianFinder class:
- MedianFinder() initializes the MedianFinder object.
- void addNum(int num) adds the integer num from the data stream to the data structure.
- double findMedian() returns the median of all elements so far. Answers within 10^-5 of the actual answer will be accepted.

Constraints:
- -10^5 <= num <= 10^5
- There will be at least one element in the data structure before calling findMedian.
- At most 5 * 10^4 calls will be made to addNum and findMedian.

Follow-up:
- If all integer numbers from the stream are in the range [0, 100], how would you optimize your solution?
- If 99% of all integer numbers from the stream are in the range [0, 100], how would you optimize your solution?', 'hard', ARRAY['two-pointers', 'design', 'sorting', 'heap', 'data-stream'], ARRAY['Use two heaps: max-heap for lower half, min-heap for upper half', 'Keep heaps balanced (sizes differ by at most 1)', 'Median is either top of one heap or average of both tops', 'Always add to max-heap first, then rebalance if needed'], '[{"input": "[\"MedianFinder\", \"addNum\", \"addNum\", \"findMedian\", \"addNum\", \"findMedian\"][[],[1],[2],[],[3],[]]", "output": "[null, null, null, 1.5, null, 2.0]", "explanation": "MedianFinder medianFinder = new MedianFinder(); medianFinder.addNum(1); medianFinder.addNum(2); medianFinder.findMedian(); // return 1.5; medianFinder.addNum(3); medianFinder.findMedian(); // return 2.0"}]'::jsonb, 'O(log n) add', 'O(n)', 'https://leetcode.com/problems/find-median-from-data-stream/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('sliding-window-maximum', 'Sliding Window Maximum', 'You are given an array of integers nums, there is a sliding window of size k which is moving from the very left of the array to the very right. You can only see the k numbers in the window. Each time the sliding window moves right by one position.

Return the max sliding window.

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- 1 <= k <= nums.length', 'hard', ARRAY['array', 'queue', 'sliding-window', 'heap', 'monotonic-queue'], ARRAY['Use a monotonic decreasing deque to store indices', 'Remove indices outside current window from front', 'Remove smaller elements from back before adding new element', 'Front of deque always has index of maximum in current window'], '[{"input": "nums = [1,3,-1,-3,5,3,6,7], k = 3", "output": "[3,3,5,5,6,7]", "explanation": "Window position                Max; ---------------               -----; [1  3  -1] -3  5  3  6  7       3; 1 [3  -1  -3] 5  3  6  7       3; 1  3 [-1  -3  5] 3  6  7       5; 1  3  -1 [-3  5  3] 6  7       5; 1  3  -1  -3 [5  3  6] 7       6; 1  3  -1  -3  5 [3  6  7]      7"}, {"input": "nums = [1], k = 1", "output": "[1]", "explanation": "Single element window."}]'::jsonb, 'O(n)', 'O(k)', 'https://leetcode.com/problems/sliding-window-maximum/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('reverse-nodes-in-k-group', 'Reverse Nodes in k-Group',
 'Given the head of a linked list, reverse the nodes of the list k at a time, and return the modified list.

k is a positive integer and is less than or equal to the length of the linked list.

If the number of nodes is not a multiple of k then left-out nodes, in the end, should remain as it is.

You may not alter the values in the list''s nodes, only nodes themselves may be changed.

Follow-up: Can you solve the problem in O(1) extra memory space?',
 'hard',
 ARRAY['linked-list', 'recursion'],
 ARRAY[
   'Check if there are k nodes available to reverse',
   'Reverse k nodes using standard reversal technique',
   'Recursively process remaining nodes',
   'Connect reversed segment to rest of list'
 ],
 '[{"input": "head = [1,2,3,4,5], k = 2", "output": "[2,1,4,3,5]", "explanation": "Groups of 2 nodes are reversed."},
   {"input": "head = [1,2,3,4,5], k = 3", "output": "[3,2,1,4,5]", "explanation": "First 3 nodes are reversed, last 2 remain as-is."}]'::jsonb,
 'O(n)',
 'O(n/k)',
 'https://leetcode.com/problems/reverse-nodes-in-k-group/',
 ARRAY['neetcode-150', 'striver-a-z']
),

('minimum-difficulty-of-a-job-schedule', 'Minimum Difficulty of a Job Schedule', 'You want to schedule a list of jobs in d days. Jobs are dependent (i.e To work on the ith job, you have to finish all the jobs j where 0 <= j < i).

You have to finish at least one task every day. The difficulty of a job schedule is the sum of difficulties of each day of the d days. The difficulty of a day is the maximum difficulty of a job done on that day.

You are given an integer array jobDifficulty and an integer d. The difficulty of the ith job is jobDifficulty[i].

Return the minimum difficulty of a job schedule. If you cannot find a schedule for the jobs return -1.

Constraints:
- 1 <= jobDifficulty.length <= 300
- 0 <= jobDifficulty[i] <= 1000
- 1 <= d <= 10', 'hard', ARRAY['array', 'dynamic-programming'], ARRAY['Use 2D DP where dp[i][j] = min difficulty for first i jobs in j days', 'For each day, try all possible job ranges', 'Track maximum difficulty in current day''s job range', 'Cannot schedule if d > number of jobs'], '[{"input": "jobDifficulty = [6,5,4,3,2,1], d = 2", "output": "7", "explanation": "First day: [6,5,4,3,2] with difficulty 6. Second day: [1] with difficulty 1. Total = 7."}, {"input": "jobDifficulty = [9,9,9], d = 4", "output": "-1", "explanation": "Cannot split 3 jobs into 4 days."}, {"input": "jobDifficulty = [1,1,1], d = 3", "output": "3", "explanation": "Each day has 1 job with difficulty 1."}]'::jsonb, 'O(n^2 * d)', 'O(n * d)', 'https://leetcode.com/problems/minimum-difficulty-of-a-job-schedule/', ARRAY['grind-75']),

('sudoku-solver', 'Sudoku Solver', 'Write a program to solve a Sudoku puzzle by filling the empty cells.

A sudoku solution must satisfy all of the following rules:
1. Each of the digits 1-9 must occur exactly once in each row.
2. Each of the digits 1-9 must occur exactly once in each column.
3. Each of the digits 1-9 must occur exactly once in each of the 9 3x3 sub-boxes of the grid.

The ''.'' character indicates empty cells.

Constraints:
- board.length == 9
- board[i].length == 9
- board[i][j] is a digit 1-9 or ''.''.
- It is guaranteed that the input board has only one solution.', 'hard', ARRAY['array', 'hash-table', 'backtracking', 'matrix'], ARRAY['Use backtracking to try digits 1-9 in empty cells', 'Check if digit is valid in current row, column, and 3x3 box', 'If placing a digit leads to dead end, backtrack', 'Optimize by choosing cell with fewest possibilities first'], '[{"input": "board = [[\"5\",\"3\",\".\",\".\",\"7\",\".\",\".\",\".\",\".\"],[\"6\",\".\",\".\",\"1\",\"9\",\"5\",\".\",\".\",\".\"],[\".\",\"9\",\"8\",\".\",\".\",\".\",\".\",\"6\",\".\"],[\"8\",\".\",\".\",\".\",\"6\",\".\",\".\",\".\",\"3\"],[\"4\",\".\",\".\",\"8\",\".\",\"3\",\".\",\".\",\"1\"],[\"7\",\".\",\".\",\".\",\"2\",\".\",\".\",\".\",\"6\"],[\".\",\"6\",\".\",\".\",\".\",\".\",\"2\",\"8\",\".\"],[\".\",\".\",\".\",\"4\",\"1\",\"9\",\".\",\".\",\"5\"],[\".\",\".\",\".\",\".\",\"8\",\".\",\".\",\"7\",\"9\"]]", "output": "[[\"5\",\"3\",\"4\",\"6\",\"7\",\"8\",\"9\",\"1\",\"2\"],[\"6\",\"7\",\"2\",\"1\",\"9\",\"5\",\"3\",\"4\",\"8\"],[\"1\",\"9\",\"8\",\"3\",\"4\",\"2\",\"5\",\"6\",\"7\"],[\"8\",\"5\",\"9\",\"7\",\"6\",\"1\",\"4\",\"2\",\"3\"],[\"4\",\"2\",\"6\",\"8\",\"5\",\"3\",\"7\",\"9\",\"1\"],[\"7\",\"1\",\"3\",\"9\",\"2\",\"4\",\"8\",\"5\",\"6\"],[\"9\",\"6\",\"1\",\"5\",\"3\",\"7\",\"2\",\"8\",\"4\"],[\"2\",\"8\",\"7\",\"4\",\"1\",\"9\",\"6\",\"3\",\"5\"],[\"3\",\"4\",\"5\",\"2\",\"8\",\"6\",\"1\",\"7\",\"9\"]]", "explanation": "The solved Sudoku puzzle."}]'::jsonb, 'O(9^m)', 'O(m)', 'https://leetcode.com/problems/sudoku-solver/', ARRAY['striver-a-z']),

('n-queens', 'N-Queens', 'The n-queens puzzle is the problem of placing n queens on an n x n chessboard such that no two queens attack each other.

Given an integer n, return all distinct solutions to the n-queens puzzle. You may return the answer in any order.

Each solution contains a distinct board configuration of the n-queens'' placement, where ''Q'' and ''.'' both indicate a queen and an empty space, respectively.

Constraints:
- 1 <= n <= 9', 'hard', ARRAY['array', 'backtracking'], ARRAY['Use backtracking to place queens row by row', 'Track columns, positive diagonals, and negative diagonals under attack', 'For row i, try placing queen in each column', 'Diagonal formulas: positive = row + col, negative = row - col'], '[{"input": "n = 4", "output": "[[\".Q..\",\"...Q\",\"Q...\",\"..Q.\"],[\"..Q.\",\"Q...\",\"...Q\",\".Q..\"]]", "explanation": "There exist two distinct solutions to the 4-queens puzzle."}, {"input": "n = 1", "output": "[[\"Q\"]]", "explanation": "Only one solution for 1-queen."}]'::jsonb, 'O(n!)', 'O(n^2)', 'https://leetcode.com/problems/n-queens/', ARRAY['neetcode-150', 'striver-a-z']),

('word-search-ii', 'Word Search II', 'Given an m x n board of characters and a list of strings words, return all words on the board.

Each word must be constructed from letters of sequentially adjacent cells, where adjacent cells are horizontally or vertically neighboring. The same letter cell may not be used more than once in a word.

Constraints:
- m == board.length
- n == board[i].length
- 1 <= m, n <= 12
- board[i][j] is a lowercase English letter.
- 1 <= words.length <= 3 * 10^4
- 1 <= words[i].length <= 10
- words[i] consists of lowercase English letters.
- All the strings of words are unique.', 'hard', ARRAY['array', 'string', 'backtracking', 'trie', 'matrix'], ARRAY['Build a Trie from all words first', 'Perform DFS on board while traversing Trie simultaneously', 'This prunes search space significantly', 'Remove found words from Trie to avoid duplicates'], '[{"input": "board = [[\"o\",\"a\",\"a\",\"n\"],[\"e\",\"t\",\"a\",\"e\"],[\"i\",\"h\",\"k\",\"r\"],[\"i\",\"f\",\"l\",\"v\"]], words = [\"oath\",\"pea\",\"eat\",\"rain\"]", "output": "[\"eat\",\"oath\"]", "explanation": "\"oath\" and \"eat\" can be found on the board."}, {"input": "board = [[\"a\",\"b\"],[\"c\",\"d\"]], words = [\"abcb\"]", "output": "[]", "explanation": "Cannot reuse cells."}]'::jsonb, 'O(m * n * 4^L)', 'O(total words length)', 'https://leetcode.com/problems/word-search-ii/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('count-of-smaller-numbers-after-self', 'Count of Smaller Numbers After Self', 'Given an integer array nums, return an integer array counts where counts[i] is the number of smaller elements to the right of nums[i].

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4', 'hard', ARRAY['array', 'binary-indexed-tree', 'segment-tree', 'binary-search', 'divide-and-conquer', 'merge-sort', 'ordered-set'], ARRAY['Use modified merge sort to count inversions', 'During merge, count how many elements from right half come before left half elements', 'Alternative: use Binary Indexed Tree (Fenwick Tree)', 'Or use balanced BST with size tracking'], '[{"input": "nums = [5,2,6,1]", "output": "[2,1,1,0]", "explanation": "To the right of 5 there are 2 smaller elements (2 and 1). To the right of 2 there is only 1 smaller element (1). To the right of 6 there is 1 smaller element (1). To the right of 1 there is 0 smaller element."}, {"input": "nums = [-1]", "output": "[0]", "explanation": "No elements to the right."}, {"input": "nums = [-1,-1]", "output": "[0,0]", "explanation": "No smaller elements."}]'::jsonb, 'O(n log n)', 'O(n)', 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/', ARRAY['striver-a-z']),

('expression-add-operators', 'Expression Add Operators', 'Given a string num that contains only digits and an integer target, return all possibilities to insert the binary operators ''+'', ''-'', and/or ''*'' between the digits of num so that the resultant expression evaluates to the target value.

Note that operands in the returned expressions should not contain leading zeros.

Constraints:
- 1 <= num.length <= 10
- num consists of only digits.
- -2^31 <= target <= 2^31 - 1', 'hard', ARRAY['math', 'string', 'backtracking'], ARRAY['Use backtracking to try all operator placements', 'Track current value and previous operand (for multiplication precedence)', 'For multiplication: subtract previous operand and add (prev * curr)', 'Handle multi-digit numbers and leading zeros'], '[{"input": "num = \"123\", target = 6", "output": "[\"1*2*3\",\"1+2+3\"]", "explanation": "Both \"1*2*3\" and \"1+2+3\" evaluate to 6."}, {"input": "num = \"232\", target = 8", "output": "[\"2*3+2\",\"2+3*2\"]", "explanation": "Both evaluate to 8."}, {"input": "num = \"3456237490\", target = 9191", "output": "[]", "explanation": "No valid expressions."}]'::jsonb, 'O(4^n)', 'O(n)', 'https://leetcode.com/problems/expression-add-operators/', ARRAY['striver-a-z']),

('basic-calculator', 'Basic Calculator', 'Given a string s representing a valid expression, implement a basic calculator to evaluate it, and return the result of the evaluation.

Note: You are not allowed to use any built-in function which evaluates strings as mathematical expressions, such as eval().

Constraints:
- 1 <= s.length <= 3 * 10^5
- s consists of digits, ''+'', ''-'', ''('', '')'', and '' ''.
- s represents a valid expression.
- ''+'' is not used as a unary operation (i.e., "+1" and "+(2 + 3)" is invalid).
- ''-'' could be used as a unary operation (i.e., "-1" and "-(2 + 3)" is valid).
- There will be no two consecutive operators in the input.
- Every number and running calculation will fit in a signed 32-bit integer.', 'hard', ARRAY['math', 'string', 'stack', 'recursion'], ARRAY['Use a stack to handle parentheses', 'Track current number and current sign', 'When encountering ''('', push current result and sign to stack', 'When encountering '')'', pop from stack and apply'], '[{"input": "s = \"1 + 1\"", "output": "2", "explanation": "1 + 1 = 2"}, {"input": "s = \" 2-1 + 2 \"", "output": "3", "explanation": "2 - 1 + 2 = 3"}, {"input": "s = \"(1+(4+5+2)-3)+(6+8)\"", "output": "23", "explanation": "Evaluate expression with parentheses."}]'::jsonb, 'O(n)', 'O(n)', 'https://leetcode.com/problems/basic-calculator/', ARRAY['grind-75', 'striver-a-z']),

('longest-increasing-path-in-a-matrix', 'Longest Increasing Path in a Matrix', 'Given an m x n integers matrix, return the length of the longest increasing path in matrix.

From each cell, you can either move in four directions: left, right, up, or down. You may not move diagonally or move outside the boundary (i.e., wrap-around is not allowed).

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 200
- 0 <= matrix[i][j] <= 2^31 - 1', 'hard', ARRAY['array', 'dynamic-programming', 'graph', 'topological-sort', 'memoization', 'depth-first-search'], ARRAY['Use DFS with memoization', 'For each cell, explore all 4 directions where next cell > current', 'Cache results to avoid recomputation', 'Answer is maximum length found from any starting cell'], '[{"input": "matrix = [[9,9,4],[6,6,8],[2,1,1]]", "output": "4", "explanation": "The longest increasing path is [1, 2, 6, 9]."}, {"input": "matrix = [[3,4,5],[3,2,6],[2,2,1]]", "output": "4", "explanation": "The longest increasing path is [3, 4, 5, 6]."}]'::jsonb, 'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/longest-increasing-path-in-a-matrix/', ARRAY['neetcode-150', 'striver-a-z'])

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




INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ARRAYS & STRINGS (Medium/Hard) ==========

('longest-palindrome', 'Longest Palindromic Substring', 'Given a string s, return the longest palindromic substring in s.

Constraints:
- 1 <= s.length <= 1000
- s consists of only digits and English letters.', 
'medium', ARRAY['string', 'dynamic-programming'], 
ARRAY['A palindrome can be seen as expanding from its center.', 'There are 2n-1 such centers (single characters and gaps between characters).', 'For each center, expand as long as the characters match.', 'Track the maximum length and the starting index.'], 
'[{"input": "s = \"babad\"", "output": "\"bab\"", "explanation": "\"aba\" is also a valid answer."}, {"input": "s = \"cbbd\"", "output": "\"bb\""}]'::jsonb, 
'O(n^2)', 'O(1)', 'https://leetcode.com/problems/longest-palindromic-substring/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('next-permutation', 'Next Permutation', 'A permutation of an array of integers is an arrangement of its members into a sequence or linear order. The next permutation of an array of integers is the next lexicographically greater permutation of its integer. If such arrangement is not possible, the array must be rearranged as the lowest possible order (i.e., sorted in ascending order).

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 100', 
'medium', ARRAY['array', 'two-pointers'], 
ARRAY['Find the first decreasing element from the right (pivot).', 'Find the smallest element to the right of the pivot that is larger than the pivot.', 'Swap them.', 'Reverse the suffix starting after the original pivot position.'], 
'[{"input": "nums = [1,2,3]", "output": "[1,3,2]"}, {"input": "nums = [3,2,1]", "output": "[1,2,3]"}, {"input": "nums = [1,1,5]", "output": "[1,5,1]"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/next-permutation/', ARRAY['striver-a-z']),

-- ========== SYSTEM DESIGN & DATA STRUCTURES (Medium/Hard) ==========

('lru-cache', 'LRU Cache', 'Design a data structure that follows the constraints of a Least Recently Used (LRU) cache. 

Implement the LRUCache class:
- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.
- int get(int key) Return the value of the key if the key exists, otherwise return -1.
- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity, evict the least recently used key.

Constraints:
- 1 <= capacity <= 3000
- 0 <= key <= 10^4
- 0 <= value <= 10^5
- At most 2 * 10^5 calls will be made to get and put.', 
'medium', ARRAY['hash-table', 'linked-list', 'design', 'doubly-linked-list'], 
ARRAY['To achieve O(1) for both get and put, you need a combination of two data structures.', 'A Hash Map provides O(1) access to nodes.', 'A Doubly Linked List maintains the order of usage (Most Recently Used at head, Least Recently Used at tail).'], 
'[{"input": "[\"LRUCache\", \"put\", \"put\", \"get\", \"put\", \"get\", \"put\", \"get\", \"get\", \"get\"] [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]", "output": "[null, null, null, 1, null, -1, null, -1, 3, 4]"}]'::jsonb, 
'O(1)', 'O(capacity)', 'https://leetcode.com/problems/lru-cache/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),



-- ========== LINKED LIST (Advanced) ==========

('add-two-numbers', 'Add Two Numbers', 'You are given two non-empty linked lists representing two non-negative integers. The digits are stored in reverse order, and each of their nodes contains a single digit. Add the two numbers and return the sum as a linked list.

Constraints:
- The number of nodes in each linked list is in the range [1, 100].
- 0 <= Node.val <= 9
- It is guaranteed that the list represents a number that does not have leading zeros, except the number 0 itself.', 
'medium', ARRAY['linked-list', 'math', 'recursion'], 
ARRAY['Keep track of a carry value across node additions.', 'Iterate until both lists are exhausted and carry is 0.', 'Create a new node for each digit of the sum (sum % 10).', 'Update carry as sum / 10.'], 
'[{"input": "l1 = [2,4,3], l2 = [5,6,4]", "output": "[7,0,8]", "explanation": "342 + 465 = 807."}, {"input": "l1 = [9,9,9], l2 = [1]", "output": "[0,0,0,1]"}]'::jsonb, 
'O(max(m, n))', 'O(max(m, n))', 'https://leetcode.com/problems/add-two-numbers/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== BINARY SEARCH & ARRAYS (Hard) ==========

('first-missing-positive', 'First Missing Positive', 'Given an unsorted integer array nums, return the smallest positive integer that is not present in nums. You must implement an algorithm that runs in O(n) time and uses O(1) auxiliary space.

Constraints:
- 1 <= nums.length <= 10^5
- -2^31 <= nums[i] <= 2^31 - 1', 
'hard', ARRAY['array', 'hash-table'], 
ARRAY['The answer must be in the range [1, n+1].', 'Use the array itself as a hash map.', 'Place each number x in its correct position: nums[x-1].', 'After reordering, the first index i where nums[i] != i + 1 is your answer.'], 
'[{"input": "nums = [1,2,0]", "output": "3"}, {"input": "nums = [3,4,-1,1]", "output": "2"}, {"input": "nums = [7,8,9,11,12]", "output": "1"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/first-missing-positive/', ARRAY['striver-a-z']),

-- ========== DYNAMIC PROGRAMMING (Medium) ==========

('decode-ways', 'Decode Ways', 'A message containing letters from A-Z can be encoded into numbers using the mapping: ''A'' -> "1", ..., ''Z'' -> "26". Given a string s containing only digits, return the number of ways to decode it.

Constraints:
- 1 <= s.length <= 100
- s contains only digits and may contain leading zero(s).', 
'medium', ARRAY['string', 'dynamic-programming'], 
ARRAY['dp[i] represents the number of ways to decode the prefix s[0...i-1].', 'If s[i-1] is between 1-9, it can be decoded as a single letter.', 'If s[i-2...i-1] is between 10-26, it can be decoded as a double letter.', 'Watch out for leading zeros and the number 0.'], 
'[{"input": "s = \"12\"", "output": "2", "explanation": "AB (1,2) or L (12)."}, {"input": "s = \"226\"", "output": "3", "explanation": "BZ (2,26), VF (22,6), or BBF (2,2,6)."}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/decode-ways/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('maximal-square', 'Maximal Square', 'Given an m x n binary matrix filled with 0''s and 1''s, find the largest square containing only 1''s and return its area.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= m, n <= 300
- matrix[i][j] is ''0'' or ''1''.', 
'medium', ARRAY['array', 'dynamic-programming', 'matrix'], 
ARRAY['dp[i][j] represents the side length of the maximum square whose bottom-right corner is at cell (i, j).', 'If matrix[i][j] is 1, dp[i][j] = min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1.', 'The area is the square of the maximum value found in dp.'], 
'[{"input": "matrix = [[\"1\",\"0\",\"1\",\"0\",\"0\"],[\"1\",\"0\",\"1\",\"1\",\"1\"],[\"1\",\"1\",\"1\",\"1\",\"1\"],[\"1\",\"0\",\"0\",\"1\",\"0\"]]", "output": "4"}]'::jsonb, 
'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/maximal-square/', ARRAY['neetcode-150', 'striver-a-z'])

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

INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ADVANCED DATA STRUCTURES (Hard) ==========

('lfu-cache', 'LFU Cache', 'Design and implement a data structure for a Least Frequently Used (LFU) cache.

Implement the LFUCache class:
- LFUCache(int capacity) Initializes the object with the capacity of the data structure.
- int get(int key) Gets the value of the key if the key exists in the cache. Otherwise, returns -1.
- void put(int key, int value) Update the value of the key if the key exists, or inserts the key if not already present. When the cache reaches its capacity, it should invalidate and remove the least frequently used key before inserting a new item. For this problem, when there is a tie (i.e., two or more keys with the same frequency), the least recently used key would be invalidated.

Constraints:
- 0 <= capacity <= 10^4
- 0 <= key <= 10^5
- 0 <= value <= 10^9
- At most 2 * 10^5 calls will be made to get and put.', 
'hard', ARRAY['hash-table', 'linked-list', 'design', 'doubly-linked-list'], 
ARRAY['You need to track both frequency and the order of usage within each frequency.', 'Use a hash map to map keys to their values and frequencies.', 'Use another hash map to map each frequency to a doubly linked list of keys.', 'Maintain a "minFrequency" variable to quickly find the victim for eviction.'], 
'[{"input": "[\"LFUCache\", \"put\", \"put\", \"get\", \"put\", \"get\", \"get\", \"put\", \"get\", \"get\", \"get\"] [[2], [1, 1], [2, 2], [1], [3, 3], [2], [3], [4, 4], [1], [3], [4]]", "output": "[null, null, null, 1, null, -1, 3, null, -1, 3, 4]"}]'::jsonb, 
'O(1)', 'O(capacity)', 'https://leetcode.com/problems/lfu-cache/', ARRAY['striver-a-z']),

-- ========== INTERVALS & SCHEDULING (Medium) ==========

('meeting-rooms-ii', 'Meeting Rooms II', 'Given an array of meeting time intervals intervals where intervals[i] = [starti, endi], return the minimum number of conference rooms required.

Constraints:
- 1 <= intervals.length <= 10^4
- 0 <= starti < endi <= 10^6', 
'medium', ARRAY['array', 'greedy', 'sorting', 'heap', 'two-pointers'], 
ARRAY['This is a "maximum overlap" problem.', 'Sort the start times and end times separately.', 'Use two pointers or a min-heap to track the end times of active meetings.', 'If a new meeting starts before the earliest meeting ends, you need a new room.'], 
'[{"input": "intervals = [[0,30],[5,10],[15,20]]", "output": "2"}, {"input": "intervals = [[7,10],[2,4]]", "output": "1"}]'::jsonb, 
'O(n log n)', 'O(n)', 'https://leetcode.com/problems/meeting-rooms-ii/', ARRAY['blind-75', 'grind-75', 'neetcode-150']),

-- ========== ADVANCED GRAPH THEORY (Medium/Hard) ==========

('is-graph-bipartite', 'Is Graph Bipartite?', 'There is an undirected graph with n nodes, where each node is numbered from 0 to n - 1. You are given a 2D array graph, where graph[u] is an array of nodes that node u is adjacent to. Return true if the graph is bipartite.

A graph is bipartite if the nodes can be partitioned into two independent sets A and B such that every edge in the graph connects a node in set A and a node in set B.

Constraints:
- graph.length == n
- 1 <= n <= 100
- 0 <= graph[u].length < n
- graph[u] does not contain u.', 
'medium', ARRAY['graph', 'depth-first-search', 'breadth-first-search', 'union-find'], 
ARRAY['A graph is bipartite if it can be 2-colored.', 'Use BFS or DFS to color each unvisited node.', 'For each neighbor, if it is uncolored, give it the opposite color of current node.', 'If a neighbor is already colored and has the same color as the current node, the graph is not bipartite.'], 
'[{"input": "graph = [[1,2,3],[0,2],[0,1,3],[0,2]]", "output": "false", "explanation": "Nodes cannot be partitioned into two independent sets."}, {"input": "graph = [[1,3],[0,2],[1,3],[0,2]]", "output": "true"}]'::jsonb, 
'O(V + E)', 'O(V)', 'https://leetcode.com/problems/is-graph-bipartite/', ARRAY['striver-a-z']),



('all-paths-source-target', 'All Paths From Source to Target', 'Given a directed acyclic graph (DAG) of n nodes labeled from 0 to n - 1, find all possible paths from node 0 to node n - 1 and return them in any order.

Constraints:
- n == graph.length
- 2 <= n <= 15
- 0 <= graph[i][j] < n
- All elements of graph[i] are unique.', 
'medium', ARRAY['backtracking', 'depth-first-search', 'graph'], 
ARRAY['Since it is a DAG, you do not need to worry about cycles.', 'Use backtracking to explore all neighbors of the current node.', 'Add the current node to the path, recurse for neighbors, and then remove the node (backtrack).'], 
'[{"input": "graph = [[1,2],[3],[3],[]]", "output": "[[0,1,3],[0,2,3]]"}]'::jsonb, 
'O(2^n * n)', 'O(n)', 'https://leetcode.com/problems/all-paths-from-source-to-target/', ARRAY['striver-a-z']),

-- ========== HARD ALGORITHMIC PUZZLES ==========

('candy', 'Candy', 'There are n children standing in a line. Each child is assigned a rating value given in the integer array ratings. You are giving candies to these children subjected to:
1. Each child must have at least one candy.
2. Children with a higher rating than their neighbors must get more candies than their neighbors.
Return the minimum number of candies you must give.

Constraints:
- n == ratings.length
- 1 <= n <= 2 * 10^4
- 0 <= ratings[i] <= 2 * 10^4', 
'hard', ARRAY['array', 'greedy'], 
ARRAY['Initialize every child with 1 candy.', 'First pass (Left to Right): If ratings[i] > ratings[i-1], give child i more than i-1.', 'Second pass (Right to Left): If ratings[i] > ratings[i+1], ensure child i has more than i+1 by taking max(current, candies[i+1] + 1).'], 
'[{"input": "ratings = [1,0,2]", "output": "5", "explanation": "Children get 2, 1, 2 candies respectively."}, {"input": "ratings = [1,2,2]", "output": "4", "explanation": "Children get 1, 2, 1 candies."}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/candy/', ARRAY['striver-a-z']),

('split-array-largest-sum', 'Split Array Largest Sum', 'Given an integer array nums and an integer k, split nums into k non-empty subarrays such that the largest sum of any subarray is minimized. Return the minimized largest sum of the split.

Constraints:
- 1 <= nums.length <= 1000
- 0 <= nums[i] <= 10^6
- 1 <= k <= min(50, nums.length)', 
'hard', ARRAY['array', 'binary-search', 'dynamic-programming', 'greedy'], 
ARRAY['Binary search on the answer (the potential largest sum).', 'Search range: [max(nums), sum(nums)].', 'For a value mid, check if you can split the array into k or fewer subarrays using a greedy approach.', 'If true, try a smaller sum; otherwise, try a larger sum.'], 
'[{"input": "nums = [7,2,5,10,8], k = 2", "output": "18", "explanation": "The optimal split is [7,2,5] and [10,8]."}]'::jsonb, 
'O(n log(sum))', 'O(1)', 'https://leetcode.com/problems/split-array-largest-sum/', ARRAY['striver-a-z']),

-- ========== BINARY SEARCH IN MATRIX (Advanced) ==========

('search-a-2d-matrix-ii', 'Search a 2D Matrix II', 'Write an efficient algorithm that searches for a value target in an m x n integer matrix matrix. This matrix has the following properties:
- Integers in each row are sorted in ascending from left to right.
- Integers in each column are sorted in ascending from top to bottom.

Constraints:
- m == matrix.length
- n == matrix[i].length
- 1 <= n, m <= 300
- -10^9 <= target <= 10^9', 
'medium', ARRAY['array', 'binary-search', 'matrix', 'divide-and-conquer'], 
ARRAY['Start from the top-right corner.', 'If current element > target, move left (the current column cannot contain target).', 'If current element < target, move down (the current row cannot contain target).', 'If equal, return true.'], 
'[{"input": "matrix = [[1,4,7,11,15],[2,5,8,12,19]], target = 5", "output": "true"}]'::jsonb, 
'O(m + n)', 'O(1)', 'https://leetcode.com/problems/search-a-2d-matrix-ii/', ARRAY['grind-75', 'striver-a-z']),

-- ========== BIT MANIPULATION & MATH (Unique) ==========

('hamming-distance', 'Hamming Distance', 'The Hamming distance between two integers is the number of positions at which the corresponding bits are different. Given two integers x and y, return the Hamming distance between them.

Constraints:
- 0 <= x, y <= 2^31 - 1', 
'easy', ARRAY['bit-manipulation'], 
ARRAY['Use the XOR operator (x ^ y) to find where bits differ.', 'The number of set bits (1s) in the result is the Hamming distance.', 'Count bits using Brian Kernighan''s algorithm or built-in functions.'], 
'[{"input": "x = 1, y = 4", "output": "2", "explanation": "1 (0001) and 4 (0100) differ at two positions."}]'::jsonb, 
'O(1)', 'O(1)', 'https://leetcode.com/problems/hamming-distance/', ARRAY['striver-a-z'])

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


INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== LINKED LIST (Advanced) ==========

('copy-random-list', 'Copy List with Random Pointer', 'A linked list of length n is given such that each node contains an additional random pointer, which could point to any node in the list, or null. Construct a deep copy of the list.

Constraints:
- 0 <= n <= 1000
- -10^4 <= Node.val <= 10^4', 
'medium', ARRAY['linked-list', 'hash-table'], 
ARRAY['Use a hash map to map each original node to its corresponding copy.', 'Perform a second pass to assign next and random pointers using the map.', 'Optimization: Interweave copied nodes with original nodes to achieve O(1) space (excluding the new list).'], 
'[{"input": "head = [[7,null],[13,0],[11,4],[10,2],[1,0]]", "output": "[[7,null],[13,0],[11,4],[10,2],[1,0]]"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/copy-list-with-random-pointer/', ARRAY['neetcode-150', 'striver-a-z']),

('sort-list', 'Sort List', 'Given the head of a linked list, return the list after sorting it in O(n log n) time and O(1) extra space.

Constraints:
- The number of nodes in the list is in the range [0, 5 * 10^4].
- -10^5 <= Node.val <= 10^5', 
'medium', ARRAY['linked-list', 'two-pointers', 'divide-and-conquer', 'sorting', 'merge-sort'], 
ARRAY['Use Merge Sort for the O(n log n) requirement.', 'Use the slow/fast pointer technique to find the middle of the list.', 'Recursively sort the two halves and merge them.', 'To achieve true O(1) space, an iterative bottom-up merge sort is required.'], 
'[{"input": "head = [4,2,1,3]", "output": "[1,2,3,4]"}, {"input": "head = [-1,5,3,4,0]", "output": "[-1,0,3,4,5]"}]'::jsonb, 
'O(n log n)', 'O(log n)', 'https://leetcode.com/problems/sort-list/', ARRAY['striver-a-z']),

-- ========== BINARY SEARCH TREE (BST) ==========

('construct-tree-preorder-inorder', 'Construct Binary Tree from Preorder and Inorder Traversal', 'Given two integer arrays preorder and inorder where preorder is the preorder traversal of a binary tree and inorder is the inorder traversal of the same tree, construct and return the binary tree.

Constraints:
- 1 <= preorder.length <= 3000
- inorder.length == preorder.length
- All values in the arrays are unique.', 
'medium', ARRAY['array', 'tree', 'hash-table', 'divide-and-conquer'], 
ARRAY['The first element of preorder is always the root.', 'Find the roots index in the inorder array; elements to the left are the left subtree, elements to the right are the right subtree.', 'Use a hash map for O(1) lookups of inorder indices.'], 
'[{"input": "preorder = [3,9,20,15,7], inorder = [9,3,15,20,7]", "output": "[3,9,20,null,null,15,7]"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/construct-binary-tree-from-preorder-and-inorder-traversal/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('sorted-array-to-bst', 'Convert Sorted Array to Binary Search Tree', 'Given an integer array nums where the elements are sorted in ascending order, convert it to a height-balanced binary search tree.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 <= nums[i] <= 10^4', 
'easy', ARRAY['array', 'tree', 'binary-search-tree', 'divide-and-conquer'], 
ARRAY['A height-balanced BST can be formed by picking the middle element as the root.', 'Recursively perform the same for the left half and right half of the array.'], 
'[{"input": "nums = [-10,-3,0,5,9]", "output": "[0,-3,9,-10,null,5]"}]'::jsonb, 
'O(n)', 'O(log n)', 'https://leetcode.com/problems/convert-sorted-array-to-binary-search-tree/', ARRAY['striver-a-z']),

-- ========== ADVANCED ARRAYS & SEARCHING ==========

('find-peak-element', 'Find Peak Element', 'A peak element is an element that is strictly greater than its neighbors. Given a 0-indexed integer array nums, find a peak element, and return its index. You must write an algorithm that runs in O(log n) time.

Constraints:
- 1 <= nums.length <= 1000
- -2^31 <= nums[i] <= 2^31 - 1', 
'medium', ARRAY['array', 'binary-search'], 
ARRAY['Even though the array is not sorted, you can use binary search.', 'If nums[mid] < nums[mid+1], there must be a peak to the right.', 'Otherwise, there must be a peak to the left (including mid).'], 
'[{"input": "nums = [1,2,3,1]", "output": "2", "explanation": "3 is a peak element and its index is 2."}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/find-peak-element/', ARRAY['neetcode-150', 'striver-a-z']),

('search-insert-position', 'Search Insert Position', 'Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 <= nums[i], target <= 10^4', 
'easy', ARRAY['array', 'binary-search'], 
ARRAY['This is a standard binary search implementation.', 'The "low" pointer will point to the correct insertion index if the target is not found.'], 
'[{"input": "nums = [1,3,5,6], target = 5", "output": "2"}, {"input": "nums = [1,3,5,6], target = 2", "output": "1"}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/search-insert-position/', ARRAY['striver-a-z', 'grind-75']),

-- ========== MATH & STRING PUZZLES (Hard) ==========

('integer-to-english-words', 'Integer to English Words', 'Convert a non-negative integer num to its English words representation.

Constraints:
- 0 <= num <= 2^31 - 1', 
'hard', ARRAY['math', 'string', 'recursion'], 
ARRAY['Break the number into groups of three (thousands, millions, billions).', 'Create helper functions to handle numbers under 1000.', 'Use arrays for words like "Twenty", "Thirteen", "Hundred".', 'Be careful with trailing spaces.'], 
'[{"input": "num = 12345", "output": "\"Twelve Thousand Three Hundred Forty Five\""}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/integer-to-english-words/', ARRAY['grind-75']),

('concatenated-words', 'Concatenated Words', 'Given an array of strings words (without duplicates), return all the concatenated words in the given list of words. A concatenated word is defined as a string that is comprised entirely of at least two shorter words in the given array.

Constraints:
- 1 <= words.length <= 10^4
- 1 <= words[i].length <= 30
- All strings in words are unique.', 
'hard', ARRAY['array', 'string', 'dynamic-programming', 'trie'], 
ARRAY['Sort the words by length.', 'Use a Set or Trie for fast lookup.', 'For each word, check if it can be formed by using words already seen (shorter words).', 'This is similar to the Word Break problem.'], 
'[{"input": "words = [\"cat\",\"cats\",\"catsdogcats\",\"dog\"]", "output": "[\"catsdogcats\"]"}]'::jsonb, 
'O(N * L^3)', 'O(N * L)', 'https://leetcode.com/problems/concatenated-words/', ARRAY['striver-a-z'])

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



INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== GRAPHS & CONNECTIVITY (Medium/Hard) ==========

('is-graph-bipartite', 'Is Graph Bipartite?', 'There is an undirected graph with n nodes, where each node is numbered from 0 to n - 1. You are given a 2D array graph, where graph[u] is an array of nodes that node u is adjacent to. Return true if the graph is bipartite.

Constraints:
- graph.length == n
- 1 <= n <= 100
- 0 <= graph[u].length < n
- graph[u] does not contain u.', 
'medium', ARRAY['graph', 'depth-first-search', 'breadth-first-search'], 
ARRAY['A graph is bipartite if it can be 2-colored such that no two adjacent nodes have the same color.', 'Use an array to store colors (e.g., -1 for uncolored, 0 and 1 for the two colors).', 'Perform BFS/DFS for every unvisited node to handle disconnected components.', 'If you find a neighbor already colored with the same color as the current node, it is not bipartite.'], 
'[{"input": "graph = [[1,3],[0,2],[1,3],[0,2]]", "output": "true", "explanation": "The nodes can be partitioned into sets {0, 2} and {1, 3}."}]'::jsonb, 
'O(V + E)', 'O(V)', 'https://leetcode.com/problems/is-graph-bipartite/', ARRAY['striver-a-z']),



('all-paths-source-target', 'All Paths From Source to Target', 'Given a directed acyclic graph (DAG) of n nodes labeled from 0 to n - 1, find all possible paths from node 0 to node n - 1 and return them in any order.

Constraints:
- n == graph.length
- 2 <= n <= 15
- 0 <= graph[i][j] < n', 
'medium', ARRAY['graph', 'depth-first-search', 'backtracking'], 
ARRAY['Since the graph is a DAG, you don''t need to worry about infinite loops/cycles.', 'Use DFS with backtracking to explore all neighbors.', 'When you reach node n-1, add the current path to the result list.', 'Backtrack by removing the last node before returning to the previous call.'], 
'[{"input": "graph = [[1,2],[3],[3],[]]", "output": "[[0,1,3],[0,2,3]]"}]'::jsonb, 
'O(2^n * n)', 'O(n)', 'https://leetcode.com/problems/all-paths-from-source-to-target/', ARRAY['striver-a-z']),

-- ========== BINARY SEARCH VARIANTS (Medium) ==========

('find-peak-element', 'Find Peak Element', 'A peak element is an element that is strictly greater than its neighbors. Given a 0-indexed integer array nums, find a peak element, and return its index. If the array contains multiple peaks, return the index to any of the peaks. You must write an algorithm that runs in O(log n) time.

Constraints:
- 1 <= nums.length <= 1000
- -2^31 <= nums[i] <= 2^31 - 1
- nums[i] != nums[i + 1] for all valid i.', 
'medium', ARRAY['array', 'binary-search'], 
ARRAY['Think about the slope of the array elements.', 'If nums[mid] < nums[mid + 1], you are on an upward slope, so a peak must exist to the right.', 'If nums[mid] > nums[mid + 1], you are on a downward slope, so a peak must exist to the left (including mid).', 'This logic converges to a peak in logarithmic time.'], 
'[{"input": "nums = [1,2,1,3,5,6,4]", "output": "5", "explanation": "Your function can return index 1 where the peak element is 2, or index 5 where the peak element is 6."}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/find-peak-element/', ARRAY['neetcode-150', 'striver-a-z']),

('search-insert-position', 'Search Insert Position', 'Given a sorted array of distinct integers and a target value, return the index if the target is found. If not, return the index where it would be if it were inserted in order.

Constraints:
- 1 <= nums.length <= 10^4
- -10^4 <= nums[i], target <= 10^4', 
'easy', ARRAY['array', 'binary-search'], 
ARRAY['Standard binary search implementation.', 'The goal is to find the first index i such that nums[i] >= target.', 'At the end of the loop, the "low" pointer will be at the correct insertion index.'], 
'[{"input": "nums = [1,3,5,6], target = 2", "output": "1"}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/search-insert-position/', ARRAY['striver-a-z', 'grind-75']),

-- ========== ADVANCED DATA STRUCTURES & DESIGN (Hard) ==========

('lfu-cache', 'LFU Cache', 'Design and implement a data structure for a Least Frequently Used (LFU) cache.

Constraints:
- 0 <= capacity <= 10^4
- At most 2 * 10^5 calls will be made to get and put.', 
'hard', ARRAY['hash-table', 'linked-list', 'design'], 
ARRAY['You need to track frequency of access for each key.', 'Use a hash map to map keys to nodes.', 'Use another hash map to map each frequency (1, 2, 3...) to a doubly linked list of keys sharing that frequency.', 'Keep track of minFrequency to find the LRU key within the LFU set for eviction.'], 
'[{"input": "[\"LFUCache\",\"put\",\"put\",\"get\",\"put\",\"get\"] [[2],[1,1],[2,2],[1],[3,3],[2]]", "output": "[null,null,null,1,null,-1]"}]'::jsonb, 
'O(1)', 'O(capacity)', 'https://leetcode.com/problems/lfu-cache/', ARRAY['striver-a-z']),



-- ========== MATHEMATICAL SIMULATION (Hard) ==========

('integer-to-english-words', 'Integer to English Words', 'Convert a non-negative integer num to its English words representation.

Constraints:
- 0 <= num <= 2^31 - 1', 
'hard', ARRAY['math', 'string', 'recursion'], 
ARRAY['Break the number into chunks of three digits (Billion, Million, Thousand).', 'Write a helper function to convert numbers < 1000 to words.', 'Handle edge cases like 0 and the correct placement of spaces.', 'Use static arrays for "Twenty", "Thirty", "Thirteen", etc.'], 
'[{"input": "num = 1234567", "output": "\"One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven\""}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/integer-to-english-words/', ARRAY['grind-75']),

('candy', 'Candy', 'There are n children standing in a line. Each child is assigned a rating value. You must give at least one candy to each child. Children with a higher rating than their neighbors must get more candies. Return the minimum candies needed.

Constraints:
- n == ratings.length
- 1 <= n <= 2 * 10^4', 
'hard', ARRAY['array', 'greedy'], 
ARRAY['This can be solved with two greedy passes.', 'Left-to-Right pass: if ratings[i] > ratings[i-1], candies[i] = candies[i-1] + 1.', 'Right-to-Left pass: if ratings[i] > ratings[i+1], candies[i] = max(candies[i], candies[i+1] + 1).', 'The sum of the candies array is the result.'], 
'[{"input": "ratings = [1,2,2]", "output": "4", "explanation": "Children get 1, 2, 1 candies respectively."}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/candy/', ARRAY['striver-a-z'])

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



INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== BINARY TREES & BST (Medium/Hard) ==========

('symmetric-tree', 'Symmetric Tree', 'Given the root of a binary tree, check whether it is a mirror of itself (i.e., symmetric around its center).

Constraints:
- The number of nodes in the tree is in the range [1, 1000].
- -100 <= Node.val <= 100', 
'easy', ARRAY['tree', 'depth-first-search', 'breadth-first-search', 'binary-tree'], 
ARRAY['Two trees are a mirror of each other if: 1. Their roots have the same value. 2. The right subtree of each tree is a mirror of the left subtree of the other.', 'You can solve this recursively by passing two nodes (left and right) to a helper function.', 'Iterative approach: Use a queue and add nodes in pairs (left.left, right.right) and (left.right, right.left).'], 
'[{"input": "root = [1,2,2,3,4,4,3]", "output": "true"}, {"input": "root = [1,2,2,null,3,null,3]", "output": "false"}]'::jsonb, 
'O(n)', 'O(h)', 'https://leetcode.com/problems/symmetric-tree/', ARRAY['grind-75', 'striver-a-z']),

('flatten-tree', 'Flatten Binary Tree to Linked List', 'Given the root of a binary tree, flatten the tree into a "linked list":
- The "linked list" should use the same TreeNode class where the right child pointer points to the next node in the list and the left child pointer is always null.
- The "linked list" should be in the same order as a pre-order traversal of the binary tree.

Constraints:
- The number of nodes in the tree is in the range [0, 2000].
- -100 <= Node.val <= 100', 
'medium', ARRAY['tree', 'depth-first-search', 'linked-list', 'stack', 'binary-tree'], 
ARRAY['Think about the reverse of a pre-order traversal: Right -> Left -> Root.', 'Use a global variable to track the "previous" processed node.', 'At each node, set current.right = prev and current.left = null, then update prev = current.', 'Alternatively, use Morris Traversal for an O(1) space solution.'], 
'[{"input": "root = [1,2,5,3,4,null,6]", "output": "[1,null,2,null,3,null,4,null,5,null,6]"}]'::jsonb, 
'O(n)', 'O(h)', 'https://leetcode.com/problems/flatten-binary-tree-to-linked-list/', ARRAY['striver-a-z']),

('binary-tree-zigzag', 'Binary Tree Zigzag Level Order Traversal', 'Given the root of a binary tree, return the zigzag level order traversal of its nodes'' values. (i.e., from left to right, then right to left for the next level and alternate between).

Constraints:
- The number of nodes in the tree is in the range [0, 2000].
- -100 <= Node.val <= 100', 
'medium', ARRAY['tree', 'breadth-first-search', 'binary-tree'], 
ARRAY['Use a queue for standard Level Order Traversal.', 'Keep a boolean flag to track the current direction (left-to-right or right-to-left).', 'For each level, use a deque or reverse the list before adding to the final result if the flag indicates right-to-left.'], 
'[{"input": "root = [3,9,20,null,null,15,7]", "output": "[[3],[20,9],[15,7]]"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/binary-tree-zigzag-level-order-traversal/', ARRAY['striver-a-z']),

-- ========== DYNAMIC PROGRAMMING (Medium) ==========

('minimum-path-sum', 'Minimum Path Sum', 'Given a m x n grid filled with non-negative numbers, find a path from top left to bottom right, which minimizes the sum of all numbers along its path. You can only move either down or right at any point in time.

Constraints:
- m == grid.length
- n == grid[i].length
- 1 <= m, n <= 200
- 0 <= grid[i][j] <= 200', 
'medium', ARRAY['array', 'dynamic-programming', 'matrix'], 
ARRAY['This is a classic DP problem. The cost to reach cell (i, j) is grid[i][j] + min(cost to reach top neighbor, cost to reach left neighbor).', 'dp[i][j] = grid[i][j] + min(dp[i-1][j], dp[i][j-1]).', 'You can optimize space by using the input grid itself or a 1D array.'], 
'[{"input": "grid = [[1,3,1],[1,5,1],[4,2,1]]", "output": "7", "explanation": "Path: 1→3→1→1→1 sum is 7."}]'::jsonb, 
'O(m * n)', 'O(1)', 'https://leetcode.com/problems/minimum-path-sum/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

-- ========== STRINGS & TWO POINTERS (Easy/Medium) ==========

('is-subsequence', 'Is Subsequence', 'Given two strings s and t, return true if s is a subsequence of t, or false otherwise.

Constraints:
- 0 <= s.length <= 100
- 0 <= t.length <= 10^4
- s and t consist only of lowercase English letters.', 
'easy', ARRAY['two-pointers', 'string', 'dynamic-programming'], 
ARRAY['Use two pointers: one for s and one for t.', 'Iterate through t. If s[i] matches t[j], increment the s pointer.', 'If the s pointer reaches the end of string s, then s is a subsequence of t.'], 
'[{"input": "s = \"abc\", t = \"ahbgdc\"", "output": "true"}, {"input": "s = \"axc\", t = \"ahbgdc\"", "output": "false"}]'::jsonb, 
'O(t.length)', 'O(1)', 'https://leetcode.com/problems/is-subsequence/', ARRAY['striver-a-z', 'grind-75']),

('backspace-string-compare', 'Backspace String Compare', 'Given two strings s and t, return true if they are equal when both are typed into empty text editors. ''#'' means a backspace character.

Constraints:
- 1 <= s.length, t.length <= 200
- s and t only contain lowercase letters and ''#'' characters.', 
'easy', ARRAY['two-pointers', 'string', 'stack', 'simulation'], 
ARRAY['Option 1: Use a stack to simulate the typing process. Push letters, pop for "#". Compare results.', 'Option 2 (O(1) space): Iterate backwards from the end of both strings. Use a "skip" counter to track how many characters need to be deleted by upcoming "#" symbols.'], 
'[{"input": "s = \"ab#c\", t = \"ad#c\"", "output": "true", "explanation": "Both become \"ac\"."}, {"input": "s = \"a#c\", t = \"b\"", "output": "false"}]'::jsonb, 
'O(n + m)', 'O(1)', 'https://leetcode.com/problems/backspace-string-compare/', ARRAY['grind-75', 'striver-a-z']),

('largest-number', 'Largest Number', 'Given a list of non-negative integers nums, arrange them such that they form the largest number and return it as a string.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 10^9', 
'medium', ARRAY['array', 'string', 'sorting', 'greedy'], 
ARRAY['Standard sorting based on numerical value won''t work (e.g., 3 vs 30).', 'Use a custom comparator: compare two numbers a and b based on the concatenated result (a + b) vs (b + a).', 'If (a + b) > (b + a), then a should come before b.', 'Special case: If the result starts with "0", return "0".'], 
'[{"input": "nums = [3,30,34,5,9]", "output": "\"9534330\""}]'::jsonb, 
'O(n log n)', 'O(n)', 'https://leetcode.com/problems/largest-number/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== GRAPHS & SEARCH (Medium/Hard) ==========

('is-graph-bipartite', 'Is Graph Bipartite?', 'Check if the graph is bipartite using 2-coloring.', 
'medium', ARRAY['graph', 'dfs', 'bfs'], 
ARRAY['Use BFS or DFS to color nodes.', 'No two adjacent nodes should have the same color.'], 
'[{"input": "graph = [[1,3],[0,2],[1,3],[0,2]]", "output": "true"}]'::jsonb, 
'O(V+E)', 'O(V)', 'https://leetcode.com/problems/is-graph-bipartite/', ARRAY['striver-a-z']),



('all-paths-source-target', 'All Paths From Source to Target', 'Find all paths from node 0 to node n-1 in a DAG.', 
'medium', ARRAY['graph', 'dfs'], 
ARRAY['Use DFS to explore all paths to the target.'], 
'[{"input": "graph = [[1,2],[3],[3],[]]", "output": "[[0,1,3],[0,2,3]]"}]'::jsonb, 
'O(2^n)', 'O(n^2)', 'https://leetcode.com/problems/all-paths-from-source-to-target/', ARRAY['striver-a-z']),

-- ========== MISCELLANEOUS HARD/ADVANCED ==========

('split-array-largest-sum', 'Split Array Largest Sum', 'Minimize the largest sum of k subarrays.', 
'hard', ARRAY['array', 'binary-search', 'greedy'], 
ARRAY['Binary search on the potential sum value.', 'Check if k subarrays are enough for a given sum.'], 
'[{"input": "nums = [7,2,5,10,8], k = 2", "output": "18"}]'::jsonb, 
'O(n log(sum))', 'O(1)', 'https://leetcode.com/problems/split-array-largest-sum/', ARRAY['striver-a-z']),

('candy', 'Candy', 'Minimum candies for children with relative ratings.', 
'hard', ARRAY['array', 'greedy'], 
ARRAY['Two-pass approach: left-to-right and right-to-left.'], 
'[{"input": "ratings = [1,0,2]", "output": "5"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/candy/', ARRAY['striver-a-z']),

('concatenated-words', 'Concatenated Words', 'Words formed by at least two other words in the list.', 
'hard', ARRAY['string', 'dynamic-programming', 'trie'], 
ARRAY['Sort by length and check if current word can be formed by shorter ones.'], 
'[{"input": "words = [\"cat\",\"cats\",\"catsdogcats\",\"dog\"]", "output": "[\"catsdogcats\"]"}]'::jsonb, 
'O(N * L^3)', 'O(N * L)', 'https://leetcode.com/problems/concatenated-words/', ARRAY['striver-a-z']),

('first-missing-positive', 'First Missing Positive', 'Smallest missing positive integer in an unsorted array.', 
'hard', ARRAY['array'], 
ARRAY['Use the array as a hash map by placing x at index x-1.'], 
'[{"input": "nums = [3,4,-1,1]", "output": "2"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/first-missing-positive/', ARRAY['striver-a-z']),

('hamming-distance', 'Hamming Distance', 'Number of bit differences between two integers.', 
'easy', ARRAY['bit-manipulation'], 
ARRAY['XOR the numbers and count the set bits.'], 
'[{"input": "x = 1, y = 4", "output": "2"}]'::jsonb, 
'O(1)', 'O(1)', 'https://leetcode.com/problems/hamming-distance/', ARRAY['striver-a-z'])

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



INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ARRAYS & STRINGS (Easy/Medium) ==========

('reverse-string', 'Reverse String', 'Write a function that reverses a string. The input string is given as an array of characters s. You must do this by modifying the input array in-place with O(1) extra memory.

Constraints:
- 1 <= s.length <= 10^5
- s[i] is a printable ascii character.', 
'easy', ARRAY['two-pointers', 'string'], 
ARRAY['Use two pointers: one at the beginning and one at the end.', 'Swap the characters at these pointers.', 'Move the pointers towards each other until they meet.'], 
'[{"input": "s = [\"h\",\"e\",\"l\",\"l\",\"o\"]", "output": "[\"o\",\"l\",\"l\",\"e\",\"h\"]"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/reverse-string/', ARRAY['striver-a-z']),

('remove-duplicates', 'Remove Duplicates from Sorted Array', 'Given an integer array nums sorted in non-decreasing order, remove the duplicates in-place such that each unique element appears only once. The relative order of the elements should be kept the same. Then return the number of unique elements in nums.

Constraints:
- 1 <= nums.length <= 3 * 10^4
- -100 <= nums[i] <= 100
- nums is sorted in non-decreasing order.', 
'easy', ARRAY['array', 'two-pointers'], 
ARRAY['Use two pointers: a slow pointer to track the position of the last unique element and a fast pointer to scan the array.', 'If nums[fast] is different from nums[slow], increment slow and update nums[slow] with nums[fast].'], 
'[{"input": "nums = [1,1,2]", "output": "2, nums = [1,2,_]"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/remove-duplicates-from-sorted-array/', ARRAY['striver-a-z']),

('merge-sorted-array', 'Merge Sorted Array', 'You are given two integer arrays nums1 and nums2, sorted in non-decreasing order, and two integers m and n, representing the number of elements in nums1 and nums2 respectively. Merge nums2 into nums1 as one sorted array.

Constraints:
- nums1.length == m + n
- nums2.length == n
- 0 <= m, n <= 200', 
'easy', ARRAY['array', 'two-pointers', 'sorting'], 
ARRAY['Start merging from the back of the arrays to avoid overwriting elements in nums1.', 'Keep pointers for the end of valid elements in nums1, the end of nums2, and the very end of nums1.', 'Place the larger of the two current elements at the end pointer.'], 
'[{"input": "nums1 = [1,2,3,0,0,0], m = 3, nums2 = [2,5,6], n = 3", "output": "[1,2,2,3,5,6]"}]'::jsonb, 
'O(m + n)', 'O(1)', 'https://leetcode.com/problems/merge-sorted-array/', ARRAY['striver-a-z']),

-- ========== GRAPHS & SEARCH (Medium/Hard) ==========

('design-tic-tac-toe', 'Design Tic-Tac-Toe', 'Assume the following rules are for the tic-tac-toe game on an n x n board between two players. Design a Tic-Tac-Toe game that is played on an n x n board and determine if a move results in a win.

Constraints:
- 2 <= n <= 100
- Player is 1 or 2.
- A move is guaranteed to be within the board.', 
'medium', ARRAY['design', 'hash-table', 'array'], 
ARRAY['You do not need to store the entire board.', 'Track the sum of moves for each row, column, and the two diagonals.', 'Assign +1 for Player 1 and -1 for Player 2.', 'A player wins if the absolute value of any row, column, or diagonal sum equals n.'], 
'[{"input": "move(0,0,1)", "output": "0", "explanation": "No one wins yet."}]'::jsonb, 
'O(1) per move', 'O(n)', 'https://leetcode.com/problems/design-tic-tac-toe/', ARRAY['neetcode-150']),



-- ========== ADVANCED MATHEMATICS & SIMULATION (Hard) ==========

('number-of-digit-one', 'Number of Digit One', 'Given an integer n, count the total number of digit 1 appearing in all non-negative integers less than or equal to n.

Constraints:
- 0 <= n <= 10^9', 
'hard', ARRAY['math', 'dynamic-programming', 'recursion'], 
ARRAY['Analyze the count digit-by-digit (units, tens, hundreds).', 'For each position, the number of 1s depends on the prefix, the digit itself, and the suffix.', 'This is a digit DP pattern or a combinatorial math approach.'], 
'[{"input": "n = 13", "output": "6", "explanation": "The digit 1 appears in 1, 10, 11, 12, 13."}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/number-of-digit-one/', ARRAY['striver-a-z']),

('k-th-smallest-in-lexicographical-order', 'K-th Smallest in Lexicographical Order', 'Given two integers n and k, return the kth lexicographically smallest integer in the range [1, n].

Constraints:
- 1 <= k <= n <= 10^9', 
'hard', ARRAY['tree'], 
ARRAY['Visualize the numbers as a 10-ary tree (denary tree).', 'Use a prefix-based search.', 'Calculate how many nodes exist in the current subtree (between prefix and prefix+1).', 'If k is within this count, move down the tree; otherwise, move to the next sibling.'], 
'[{"input": "n = 13, k = 2", "output": "10", "explanation": "The sequence is 1, 10, 11, 12, 13, 2..."}]'::jsonb, 
'O((log n)^2)', 'O(1)', 'https://leetcode.com/problems/k-th-smallest-in-lexicographical-order/', ARRAY['grind-75']),



('count-subarrays-with-fixed-bounds', 'Count Subarrays With Fixed Bounds', 'Return the number of subarrays where the min element is minK and the max element is maxK.

Constraints:
- 2 <= nums.length <= 10^5
- 1 <= nums[i], minK, maxK <= 10^6', 
'hard', ARRAY['array', 'sliding-window'], 
ARRAY['Use a sliding window or a single-pass approach.', 'Track the last seen indices of minK, maxK, and any value that is out of the [minK, maxK] range.', 'A valid subarray ending at current index exists if minK and maxK have been seen since the last "out-of-bound" value.'], 
'[{"input": "nums = [1,3,5,2,7,5], minK = 1, maxK = 5", "output": "2"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/count-subarrays-with-fixed-bounds/', ARRAY['grind-75']),

-- ========== MISCELLANEOUS (Easy/Medium) ==========

('majority-element', 'Majority Element', 'Find the element that appears more than n/2 times.', 
'easy', ARRAY['array', 'hash-table', 'sorting'], 
ARRAY['Use Boyer-Moore Voting Algorithm for O(1) space.', 'Maintain a candidate and a count; increment for same, decrement for different.'], 
'[{"input": "nums = [3,2,3]", "output": "3"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/majority-element/', ARRAY['grind-75', 'striver-a-z', 'neetcode-150']),

('island-perimeter', 'Island Perimeter', 'Calculate the perimeter of the island represented by 1s in a grid.', 
'easy', ARRAY['array', 'matrix'], 
ARRAY['For every 1, add 4 to the perimeter.', 'Subtract 2 for every adjacent pair of 1s (horizontal or vertical).'], 
'[{"input": "grid = [[0,1,0,0],[1,1,1,0]]", "output": "16"}]'::jsonb, 
'O(m * n)', 'O(1)', 'https://leetcode.com/problems/island-perimeter/', ARRAY['neetcode-150']),

('meeting-rooms', 'Meeting Rooms', 'Check if a person could attend all meetings.', 
'easy', ARRAY['sorting', 'intervals'], 
ARRAY['Sort meetings by start time.', 'Check if any meeting starts before the previous one ends.'], 
'[{"input": "intervals = [[0,30],[5,10]]", "output": "false"}]'::jsonb, 
'O(n log n)', 'O(1)', 'https://leetcode.com/problems/meeting-rooms/', ARRAY['blind-75', 'grind-75', 'neetcode-150']),

('shift-2d-grid', 'Shift 2D Grid', 'Shift elements of an m x n grid k times.', 
'easy', ARRAY['array', 'simulation'], 
ARRAY['Think of the 2D grid as a 1D array of size m*n.', 'The new position of an element at (r, c) is determined by ((r * n + c + k) % (m * n)).'], 
'[{"input": "grid = [[1,2,3],[4,5,6]], k = 1", "output": "[[6,1,2],[3,4,5]]"}]'::jsonb, 
'O(m * n)', 'O(m * n)', 'https://leetcode.com/problems/shift-2d-grid/', ARRAY['striver-a-z']),

('count-and-say', 'Count and Say', 'Generate the nth term in the count-and-say sequence.', 
'medium', ARRAY['string', 'simulation'], 
ARRAY['Iteratively build strings.', 'Count consecutive identical characters and append "count + digit".'], 
'[{"input": "n = 4", "output": "\"1211\""}]'::jsonb, 
'O(n * L)', 'O(L)', 'https://leetcode.com/problems/count-and-say/', ARRAY['striver-a-z']),

('search-in-2d-matrix-iii', 'Search a 2D Matrix III', 'Search in a matrix where each row and column is sorted.', 
'medium', ARRAY['matrix', 'binary-search'], 
ARRAY['Start from the top-right corner to eliminate a row or column at each step.'], 
'[{"input": "matrix = [[1,4],[2,5]], target = 2", "output": "true"}]'::jsonb, 
'O(m + n)', 'O(1)', 'https://leetcode.com/problems/search-a-2d-matrix-iii/', ARRAY['striver-a-z'])

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


INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ARRAYS & STRINGS (Easy) ==========

('intersection-arrays', 'Intersection of Two Arrays II', 'Given two integer arrays nums1 and nums2, return an array of their intersection. Each element in the result must appear as many times as it shows in both arrays and you may return the result in any order.

Constraints:
- 1 <= nums1.length, nums2.length <= 1000
- 0 <= nums1[i], nums2[i] <= 1000

Follow-up:
- What if the given array is already sorted? How would you optimize your algorithm?
- What if nums1''s size is small compared to nums2''s size? Which algorithm is better?
- What if elements of nums2 are stored on disk, and the memory is limited such that you cannot load all elements into the memory at once?', 
'easy', ARRAY['array', 'hash-table', 'two-pointers', 'sorting'], 
ARRAY['Use a hash map to count occurrences of each number in the first array.', 'Iterate through the second array; if a number exists in the map and its count > 0, add it to the result and decrement the count.', 'If sorted, use two pointers to compare elements without extra space.'], 
'[{"input": "nums1 = [1,2,2,1], nums2 = [2,2]", "output": "[2,2]"}, {"input": "nums1 = [4,9,5], nums2 = [9,4,9,8,4]", "output": "[4,9]"}]'::jsonb, 
'O(n + m)', 'O(min(n, m))', 'https://leetcode.com/problems/intersection-of-two-arrays-ii/', ARRAY['striver-a-z']),

-- ========== BINARY TREES (Easy) ==========

('binary-tree-traversal', 'Binary Tree Inorder Traversal', 'Given the root of a binary tree, return the inorder traversal of its nodes'' values. 

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100

Follow-up: Recursive solution is trivial, could you do it iteratively?', 
'easy', ARRAY['tree', 'depth-first-search', 'stack', 'binary-tree'], 
ARRAY['Inorder traversal follows the pattern: Left -> Root -> Right.', 'Recursive: call helper(root.left), visit root, then helper(root.right).', 'Iterative: Use a stack to simulate the recursion. Push all left children of the current node onto the stack, then process the top, then move to its right child.', 'Morris Traversal: Can achieve O(1) space by temporarily modifying tree pointers.'], 
'[{"input": "root = [1,null,2,3]", "output": "[1,3,2]"}, {"input": "root = []", "output": "[]"}, {"input": "root = [1]", "output": "[1]"}]'::jsonb, 
'O(n)', 'O(h)', 'https://leetcode.com/problems/binary-tree-inorder-traversal/', ARRAY['striver-a-z'])

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




INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== ARRAYS & TWO POINTERS (Medium) ==========

('search-rotated-array', 'Search in Rotated Sorted Array', 'There is an integer array nums sorted in ascending order (with distinct values). Prior to being passed to your function, nums is possibly rotated at an unknown pivot index k. Given the array nums after the rotation and an integer target, return the index of target if it is in nums, or -1 if it is not in nums. You must write an algorithm with O(log n) runtime complexity.

Constraints:
- 1 <= nums.length <= 5000
- -10^4 <= nums[i], target <= 10^4
- All values of nums are unique.', 
'medium', ARRAY['array', 'binary-search'], 
ARRAY['In any rotation, at least one half (left or right) of the array must be sorted.', 'Check if the left half [low, mid] is sorted by comparing nums[low] and nums[mid].', 'If the left half is sorted, check if the target lies within its range.', 'If not, the target must be in the right half (or vice versa).'], 
'[{"input": "nums = [4,5,6,7,0,1,2], target = 0", "output": "4"}, {"input": "nums = [4,5,6,7,0,1,2], target = 3", "output": "-1"}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/search-in-rotated-sorted-array/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('largest-number', 'Largest Number', 'Given a list of non-negative integers nums, arrange them such that they form the largest number and return it as a string. Since the result may be very large, you need to return a string instead of an integer.

Constraints:
- 1 <= nums.length <= 100
- 0 <= nums[i] <= 10^9', 
'medium', ARRAY['array', 'string', 'sorting', 'greedy'], 
ARRAY['Numerical sorting doesn''t work (e.g., "30" vs "3").', 'Convert all integers to strings.', 'Define a custom comparator: for two strings A and B, compare (A + B) with (B + A).', 'If A + B > B + A, then A should come before B.', 'Edge case: if the sorted array begins with "0", the result is "0".'], 
'[{"input": "nums = [3,30,34,5,9]", "output": "\"9534330\""}, {"input": "nums = [10,2]", "output": "\"210\""}]'::jsonb, 
'O(n log n)', 'O(n)', 'https://leetcode.com/problems/largest-number/', ARRAY['neetcode-150', 'striver-a-z']),

('container-with-most-water', 'Container With Most Water', 'You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store.

Constraints:
- n == height.length
- 2 <= n <= 10^5
- 0 <= height[i] <= 10^4', 
'medium', ARRAY['array', 'two-pointers', 'greedy'], 
ARRAY['The amount of water is limited by the shorter line: Area = min(h1, h2) * width.', 'Use two pointers, one at each end of the array.', 'To potentially find a larger area, move the pointer pointing to the shorter line.', 'Moving the longer line can only decrease the area, as the width decreases and the height is still capped by the shorter line.'], 
'[{"input": "height = [1,8,6,2,5,4,8,3,7]", "output": "49"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/container-with-most-water/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),



-- ========== HEAP & SEARCH (Medium) ==========

('kth-largest', 'Kth Largest Element in an Array', 'Given an integer array nums and an integer k, return the kth largest element in the array. Note that it is the kth largest element in the sorted order, not the kth distinct element.

Constraints:
- 1 <= k <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4', 
'medium', ARRAY['array', 'divide-and-conquer', 'heap', 'quickselect', 'sorting'], 
ARRAY['Option 1: Sort the array and return nums[n-k] (O(n log n)).', 'Option 2: Use a min-heap of size k to store the largest elements seen so far (O(n log k)).', 'Option 3: Use the QuickSelect algorithm for O(n) average time complexity.'], 
'[{"input": "nums = [3,2,3,1,2,4,5,5,6], k = 4", "output": "4"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/kth-largest-element-in-an-array/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

-- ========== DYNAMIC PROGRAMMING (Hard) ==========

('median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall run time complexity should be O(log (m+n)).

Constraints:
- nums1.length == m, nums2.length == n
- 0 <= m, n <= 1000
- 1 <= m + n <= 2000', 
'hard', ARRAY['array', 'binary-search', 'divide-and-conquer'], 
ARRAY['We need to partition both arrays such that the total number of elements on the left side equals the right side.', 'Perform binary search on the smaller array to find the correct partition point.', 'Verify the partition: maxLeft1 <= minRight2 AND maxLeft2 <= minRight1.', 'For even totals, median is the average of max(lefts) and min(rights).'], 
'[{"input": "nums1 = [1,3], nums2 = [2]", "output": "2.00000"}, {"input": "nums1 = [1,2], nums2 = [3,4]", "output": "2.50000"}]'::jsonb, 
'O(log(min(m, n)))', 'O(1)', 'https://leetcode.com/problems/median-of-two-sorted-arrays/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('trapping-rain-water', 'Trapping Rain Water', 'Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.

Constraints:
- n == height.length
- 1 <= n <= 2 * 10^4
- 0 <= height[i] <= 10^5', 
'hard', ARRAY['array', 'two-pointers', 'dynamic-programming', 'stack', 'monotonic-stack'], 
ARRAY['A cell can trap water if there are taller bars to its left and right.', 'Water at index i = min(maxLeft[i], maxRight[i]) - height[i].', 'Optimized: Use two pointers (left, right) and maintain leftMax and rightMax.', 'If leftMax < rightMax, the water at the left pointer is determined by leftMax.'], 
'[{"input": "height = [0,1,0,2,1,0,1,3,2,1,2,1]", "output": "6"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/trapping-rain-water/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),



-- ========== ADVANCED GRAPH & TREE (Hard) ==========

('word-ladder', 'Word Ladder', 'A transformation sequence from word beginWord to word endWord using a dictionary wordList is a sequence of words where each adjacent pair differs by exactly one letter. Return the number of words in the shortest transformation sequence.

Constraints:
- 1 <= beginWord.length <= 10
- 1 <= wordList.length <= 5000', 
'hard', ARRAY['hash-table', 'string', 'breadth-first-search'], 
ARRAY['This is a shortest path problem in an unweighted graph.', 'Each word is a node, and an edge exists between words that differ by one letter.', 'Use BFS to find the shortest path.', 'To find neighbors quickly, replace each character of the current word with ''a''-''z'' and check the dictionary set.'], 
'[{"input": "beginWord = \"hit\", endWord = \"cog\", wordList = [\"hot\",\"dot\",\"dog\",\"lot\",\"log\",\"cog\"]", "output": "5"}]'::jsonb, 
'O(N * M^2)', 'O(N * M)', 'https://leetcode.com/problems/word-ladder/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('binary-tree-max-path-sum', 'Binary Tree Maximum Path Sum', 'Find the maximum path sum of any non-empty path in a binary tree. The path does not need to pass through the root.

Constraints:
- The number of nodes is in the range [1, 3 * 10^4].
- -1000 <= Node.val <= 1000', 
'hard', ARRAY['tree', 'depth-first-search', 'dynamic-programming', 'binary-tree'], 
ARRAY['At each node, calculate the maximum contribution it can give to a path reaching its parent.', 'Max Gain = node.val + max(0, leftGain, rightGain).', 'The "local" max path passing through the current node as the highest point is: leftGain + rightGain + node.val.', 'Update a global maximum with this local path sum at every node.'], 
'[{"input": "root = [-10,9,20,null,null,15,7]", "output": "42"}]'::jsonb, 
'O(n)', 'O(h)', 'https://leetcode.com/problems/binary-tree-maximum-path-sum/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z'])

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


INSERT INTO public.problems (id, title, description, difficulty, tags, hints, examples, time_complexity, space_complexity, external_url, curated_lists) VALUES

-- ========== GROUP 1: ARRAYS & HASHING / TWO POINTERS ==========

('top-k-frequent-elements', 'Top K Frequent Elements', 'Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.

Constraints:
- 1 <= nums.length <= 10^5
- -10^4 <= nums[i] <= 10^4
- k is in the range [1, number of unique elements]
- It is guaranteed that the answer is unique.', 
'medium', ARRAY['array', 'hash-table', 'heap', 'bucket-sort'], 
ARRAY['First, build a frequency map of all elements.', 'Option 1: Use a Min-Heap of size k (O(n log k)).', 'Option 2: Use Bucket Sort where the index of the bucket array represents the frequency (O(n)).', 'In Bucket Sort, since the maximum frequency is n, the bucket array size is n+1.'], 
'[{"input": "nums = [1,1,1,2,2,3], k = 2", "output": "[1,2]"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/top-k-frequent-elements/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('valid-sudoku', 'Valid Sudoku', 'Determine if a 9 x 9 Sudoku board is valid. Only the filled cells need to be validated according to the following rules:
1. Each row must contain the digits 1-9 without repetition.
2. Each column must contain the digits 1-9 without repetition.
3. Each of the nine 3 x 3 sub-boxes must contain the digits 1-9 without repetition.

Constraints:
- board.length == 9
- board[i].length == 9
- board[i][j] is a digit 1-9 or ".".', 
'medium', ARRAY['array', 'hash-table', 'matrix'], 
ARRAY['Use three sets of hash sets: one for rows, one for columns, and one for the nine 3x3 boxes.', 'For a cell (r, c), the box index can be calculated as (r / 3) * 3 + (c / 3).', 'Iterate through the board once. For each non-empty cell, check if the digit exists in the corresponding row, column, or box set.'], 
'[{"input": "board = [...]", "output": "true"}]'::jsonb, 
'O(1)', 'O(1)', 'https://leetcode.com/problems/valid-sudoku/', ARRAY['neetcode-150', 'striver-a-z']),



('valid-palindrome', 'Valid Palindrome', 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. 

Constraints:
- 1 <= s.length <= 2 * 10^5
- s consists only of printable ASCII characters.', 
'easy', ARRAY['two-pointers', 'string'], 
ARRAY['Use two pointers: "left" starting at 0 and "right" starting at the end.', 'Move the pointers inward, skipping any character that is not alphanumeric.', 'Compare the characters in lowercase.'], 
'[{"input": "s = \"A man, a plan, a canal: Panama\"", "output": "true"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/valid-palindrome/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('two-sum-ii', 'Two Sum II - Input Array Is Sorted', 'Given a 1-indexed array of integers numbers that is already sorted in non-decreasing order, find two numbers such that they add up to a specific target number.

Constraints:
- 2 <= numbers.length <= 3 * 10^4
- numbers is sorted in non-decreasing order.
- Exactly one solution exists.', 
'medium', ARRAY['array', 'two-pointers', 'binary-search'], 
ARRAY['Since the array is sorted, we can use two pointers at the extreme ends.', 'If currentSum < target, move the left pointer right. If currentSum > target, move the right pointer left.'], 
'[{"input": "numbers = [2,7,11,15], target = 9", "output": "[1,2]"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/two-sum-ii-input-array-is-sorted/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== GROUP 2: SLIDING WINDOW & STACK ==========

('longest-substring-without-repeating-characters', 'Longest Substring Without Repeating Characters', 'Given a string s, find the length of the longest substring without repeating characters.

Constraints:
- 0 <= s.length <= 5 * 10^4', 
'medium', ARRAY['hash-table', 'string', 'sliding-window'], 
ARRAY['Use a sliding window with two pointers (left, right).', 'Use a hash map or a frequency array to store the last seen index of each character.'], 
'[{"input": "s = \"abcabcbb\"", "output": "3"}]'::jsonb, 
'O(n)', 'O(min(m, n))', 'https://leetcode.com/problems/longest-substring-without-repeating-characters/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('longest-repeating-character-replacement', 'Longest Repeating Character Replacement', 'Return the length of the longest substring containing the same letter you can get after performing at most k character replacements.

Constraints:
- 1 <= s.length <= 10^5
- 0 <= k <= s.length', 
'medium', ARRAY['hash-table', 'string', 'sliding-window'], 
ARRAY['Use a sliding window and a frequency map.', 'A window is valid if (window_length - maxFreq) <= k.', 'If invalid, shrink the window from the left.'], 
'[{"input": "s = \"ABAB\", k = 2", "output": "4"}]'::jsonb, 
'O(n)', 'O(26)', 'https://leetcode.com/problems/longest-repeating-character-replacement/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('permutation-in-string', 'Permutation in String', 'Given two strings s1 and s2, return true if s2 contains a permutation of s1.

Constraints:
- 1 <= s1.length, s2.length <= 10^4', 
'medium', ARRAY['hash-table', 'two-pointers', 'string', 'sliding-window'], 
ARRAY['Use a fixed-size sliding window on s2 equal to the length of s1.', 'Maintain two frequency arrays for characters in s1 and the current window of s2.'], 
'[{"input": "s1 = \"ab\", s2 = \"eidbaooo\"", "output": "true"}]'::jsonb, 
'O(n)', 'O(1)', 'https://leetcode.com/problems/permutation-in-string/', ARRAY['neetcode-150', 'striver-a-z']),

('min-stack', 'Min Stack', 'Design a stack that supports push, pop, top, and retrieving the minimum element in constant time.

Constraints:
- -2^31 <= val <= 2^31 - 1
- At most 3 * 10^4 calls will be made.', 
'medium', ARRAY['stack', 'design'], 
ARRAY['Option 1: Use two stacks—one for values and one for the current minimum.', 'Option 2: Store pairs [value, current_min] in a single stack.'], 
'[{"input": "[\"MinStack\",\"push\",\"push\",\"getMin\"]", "output": "[null,null,null,-3]"}]'::jsonb, 
'O(1)', 'O(n)', 'https://leetcode.com/problems/min-stack/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('evaluate-reverse-polish-notation', 'Evaluate Reverse Polish Notation', 'Evaluate the value of an arithmetic expression in Reverse Polish Notation.

Constraints:
- 1 <= tokens.length <= 10^4
- tokens[i] is "+", "-", "*", "/", or an integer.', 
'medium', ARRAY['array', 'math', 'stack'], 
ARRAY['Use a stack to store operands.', 'When an operator appears, pop two numbers and push the result back.'], 
'[{"input": "tokens = [\"2\",\"1\",\"+\",\"3\",\"*\"]", "output": "9"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/evaluate-reverse-polish-notation/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('daily-temperatures', 'Daily Temperatures', 'Given an array of integers temperatures, return an array of the number of days to wait for a warmer temperature.

Constraints:
- 1 <= temperatures.length <= 10^5', 
'medium', ARRAY['array', 'stack', 'monotonic-stack'], 
ARRAY['Use a monotonic decreasing stack to store indices.', 'While the current temperature is warmer than the stack top, pop and calculate (current - popped).'], 
'[{"input": "temperatures = [73,74,75,71,69,72,76,73]", "output": "[1,1,4,2,1,1,0,0]"}]'::jsonb, 
'O(n)', 'O(n)', 'https://leetcode.com/problems/daily-temperatures/', ARRAY['neetcode-150', 'striver-a-z']),

-- ========== GROUP 3: BINARY TREE / SEARCH / HEAP ==========

('diameter-of-binary-tree', 'Diameter of Binary Tree', 'The diameter of a binary tree is the length of the longest path between any two nodes.

Constraints:
- The number of nodes is in the range [1, 10^4].', 
'easy', ARRAY['tree', 'depth-first-search', 'binary-tree'], 
ARRAY['The diameter at a node is (left_height + right_height).', 'Update a global max during a recursive height calculation.'], 
'[{"input": "root = [1,2,3,4,5]", "output": "3"}]'::jsonb, 
'O(n)', 'O(h)', 'https://leetcode.com/problems/diameter-of-binary-tree/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),



('subtree-of-another-tree', 'Subtree of Another Tree', 'Check if there is a subtree of root with the same structure and values of subRoot.', 
'easy', ARRAY['tree', 'depth-first-search', 'binary-tree'], 
ARRAY['Use a helper function isSameTree.', 'Check isSameTree for every node in the root tree.'], 
'[{"input": "root = [3,4,5,1,2], subRoot = [4,1,2]", "output": "true"}]'::jsonb, 
'O(m * n)', 'O(h)', 'https://leetcode.com/problems/subtree-of-another-tree/', ARRAY['blind-75', 'neetcode-150', 'striver-a-z']),

('lowest-common-ancestor-of-a-binary-search-tree', 'Lowest Common Ancestor of a BST', 'Find the lowest common ancestor (LCA) node of two given nodes p and q in a BST.', 
'medium', ARRAY['tree', 'depth-first-search', 'binary-search-tree', 'binary-tree'], 
ARRAY['If both smaller than root, go left. If both larger, go right. Otherwise, current is LCA.'], 
'[{"input": "root = [6,2,8,0,4,7,9], p = 2, q = 8", "output": "6"}]'::jsonb, 
'O(h)', 'O(h)', 'https://leetcode.com/problems/lowest-common-ancestor-of-a-binary-search-tree/', ARRAY['blind-75', 'grind-75', 'neetcode-150', 'striver-a-z']),

('binary-search', 'Binary Search', 'Given an array sorted in ascending order, search for a target.', 
'easy', ARRAY['array', 'binary-search'], 
ARRAY['Standard low/high pointer approach.', 'Calculate mid = low + (high-low)/2.'], 
'[{"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4"}]'::jsonb, 
'O(log n)', 'O(1)', 'https://leetcode.com/problems/binary-search/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z']),

('koko-eating-bananas', 'Koko Eating Bananas', 'Return the minimum integer k such that Koko can eat all bananas within h hours.', 
'medium', ARRAY['array', 'binary-search'], 
ARRAY['Binary Search on the answer range [1, max(piles)].', 'For each speed, sum up the hours (ceil(pile/speed)).'], 
'[{"input": "piles = [3,6,7,11], h = 8", "output": "4"}]'::jsonb, 
'O(n log(max(piles)))', 'O(1)', 'https://leetcode.com/problems/koko-eating-bananas/', ARRAY['neetcode-150', 'striver-a-z']),



('kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'Design a class to find the kth largest element in a stream.', 
'easy', ARRAY['tree', 'design', 'heap'], 
ARRAY['Maintain a Min-Heap of size k.', 'The top of the heap is the kth largest element.'], 
'[{"input": "[\"KthLargest\", \"add\"] [[3, [4,5,8,2]], [3]]", "output": "[null, 4]"}]'::jsonb, 
'O(log k)', 'O(k)', 'https://leetcode.com/problems/kth-largest-element-in-a-stream/', ARRAY['neetcode-150', 'striver-a-z']),

('last-stone-weight', 'Last Stone Weight', 'Combine the two heaviest stones until one remains.', 
'easy', ARRAY['array', 'heap'], 
ARRAY['Use a Max-Heap.', 'Pop two, calculate diff, push diff back if > 0.'], 
'[{"input": "stones = [2,7,4,1,8,1]", "output": "1"}]'::jsonb, 
'O(n log n)', 'O(n)', 'https://leetcode.com/problems/last-stone-weight/', ARRAY['neetcode-150', 'striver-a-z']),

('k-closest-points-to-origin', 'K Closest Points to Origin', 'Find the k closest points to (0,0) using Euclidean distance.', 
'medium', ARRAY['array', 'heap', 'quickselect'], 
ARRAY['Distance squared is (x^2 + y^2).', 'Use a Max-Heap of size k or QuickSelect.'], 
'[{"input": "points = [[1,3],[-2,2]], k = 1", "output": "[[-2,2]]"}]'::jsonb, 
'O(n log k)', 'O(k)', 'https://leetcode.com/problems/k-closest-points-to-origin/', ARRAY['grind-75', 'neetcode-150', 'striver-a-z'])

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


    