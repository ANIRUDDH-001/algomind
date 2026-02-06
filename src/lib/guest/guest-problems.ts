import type { Problem } from '@/lib/supabase/problems';

/**
 * 5 Classic DSA problems for guest users
 * Each includes pre-embedded RAG context to minimize Gemini API calls
 */
export const GUEST_PROBLEMS: (Problem & { ragContext: string })[] = [
    {
        id: 'guest-two-sum',
        title: 'Two Sum',
        description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

You can return the answer in any order.`,
        difficulty: 'easy',
        tags: ['Array', 'Hash Table'],
        hints: [
            'A brute force approach would be O(n²) - can you do better?',
            'What if you stored values you\'ve seen in a hash map?',
            'For each number, check if (target - number) exists in your map'
        ],
        examples: [
            {
                input: 'nums = [2,7,11,15], target = 9',
                output: '[0,1]',
                explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].'
            },
            {
                input: 'nums = [3,2,4], target = 6',
                output: '[1,2]'
            }
        ],
        external_url: 'https://leetcode.com/problems/two-sum/',
        ragContext: `### Two Sum - Complete Guide

**Pattern**: Hash Map / Complement Search

**Optimal Approach**:
1. Create an empty hash map to store {value: index}
2. Iterate through the array once
3. For each element, calculate complement = target - current
4. Check if complement exists in hash map
5. If yes, return [map[complement], currentIndex]
6. If no, add current element to map

**Time Complexity**: O(n) - single pass through array
**Space Complexity**: O(n) - hash map storage

**Edge Cases**:
- Duplicate values: [3, 3] target=6 → works because we check before adding
- Negative numbers: [-1, -2, -3] target=-4 → same logic applies
- Single valid pair: always guaranteed per problem constraint
- Large arrays: hash map provides constant lookup

**Common Mistakes**:
- Using same element twice (check index !== stored index)
- Returning wrong order of indices
- Not handling negative numbers (they work the same)

**Code Pattern**:
\`\`\`
map = {}
for i, num in enumerate(nums):
    complement = target - num
    if complement in map:
        return [map[complement], i]
    map[num] = i
\`\`\`

**Follow-up**: What if array is sorted? → Two pointers O(1) space`
    },
    {
        id: 'guest-valid-parentheses',
        title: 'Valid Parentheses',
        description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
        difficulty: 'easy',
        tags: ['String', 'Stack'],
        hints: [
            'Use a stack data structure',
            'Push opening brackets onto stack',
            'For closing brackets, check if top of stack matches'
        ],
        examples: [
            {
                input: 's = "()"',
                output: 'true'
            },
            {
                input: 's = "()[]{}"',
                output: 'true'
            },
            {
                input: 's = "(]"',
                output: 'false'
            }
        ],
        external_url: 'https://leetcode.com/problems/valid-parentheses/',
        ragContext: `### Valid Parentheses - Complete Guide

**Pattern**: Stack (LIFO)

**Optimal Approach**:
1. Create a stack and a mapping of closing → opening brackets
2. Iterate through each character
3. If opening bracket: push to stack
4. If closing bracket: check if stack top matches corresponding opener
5. Return true if stack is empty at end

**Time Complexity**: O(n) - single pass
**Space Complexity**: O(n) - stack can hold all characters

**Edge Cases**:
- Empty string "" → true (no brackets to match)
- Single bracket "(" → false (unmatched)
- Only opening "((((" → false
- Only closing "))))" → false (stack underflow)
- Nested correctly "({[]})" → true
- Interleaved wrong "([)]" → false

**Common Mistakes**:
- Forgetting to check if stack is empty before pop
- Not checking stack is empty at the end
- Wrong bracket mapping

**Code Pattern**:
\`\`\`
stack = []
mapping = {')': '(', '}': '{', ']': '['}
for char in s:
    if char in mapping:  # closing bracket
        if not stack or stack.pop() != mapping[char]:
            return False
    else:  # opening bracket
        stack.append(char)
return len(stack) == 0
\`\`\`

**Variations**: 
- Remove invalid parentheses (BFS/backtracking)
- Longest valid parentheses (DP)`
    },
    {
        id: 'guest-reverse-linked-list',
        title: 'Reverse Linked List',
        description: `Given the head of a singly linked list, reverse the list, and return the reversed list.`,
        difficulty: 'easy',
        tags: ['Linked List', 'Recursion'],
        hints: [
            'You need three pointers: prev, current, next',
            'At each step, reverse the current node\'s pointer',
            'Move all three pointers forward'
        ],
        examples: [
            {
                input: 'head = [1,2,3,4,5]',
                output: '[5,4,3,2,1]'
            },
            {
                input: 'head = [1,2]',
                output: '[2,1]'
            }
        ],
        external_url: 'https://leetcode.com/problems/reverse-linked-list/',
        ragContext: `### Reverse Linked List - Complete Guide

**Pattern**: Two/Three Pointers

**Iterative Approach**:
1. Initialize: prev = null, current = head
2. While current is not null:
   - Save next = current.next
   - Reverse pointer: current.next = prev
   - Move prev = current
   - Move current = next
3. Return prev (new head)

**Recursive Approach**:
1. Base case: head is null or head.next is null → return head
2. Recursively reverse rest of list
3. Set head.next.next = head (reverse the link)
4. Set head.next = null (break forward link)
5. Return new head from recursion

**Time Complexity**: O(n) - visit each node once
**Space Complexity**: 
- Iterative: O(1) - constant extra space
- Recursive: O(n) - call stack

**Edge Cases**:
- Empty list (null) → return null
- Single node [1] → return same node
- Two nodes [1,2] → [2,1]

**Common Mistakes**:
- Losing reference to next node before reversing
- Not updating head correctly
- Infinite loop from incorrect pointer updates

**Iterative Code**:
\`\`\`
prev = None
current = head
while current:
    next_node = current.next
    current.next = prev
    prev = current
    current = next_node
return prev
\`\`\`

**Follow-up**: Reverse in groups of k, reverse between positions m and n`
    },
    {
        id: 'guest-max-subarray',
        title: 'Maximum Subarray',
        description: `Given an integer array nums, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous non-empty sequence of elements within an array.`,
        difficulty: 'medium',
        tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
        hints: [
            'Think about when you should start a new subarray vs extend current',
            'Kadane\'s algorithm: keep track of max ending at current position',
            'At each position: max(current element, current element + previous max)'
        ],
        examples: [
            {
                input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
                output: '6',
                explanation: 'The subarray [4,-1,2,1] has the largest sum 6.'
            },
            {
                input: 'nums = [1]',
                output: '1'
            }
        ],
        external_url: 'https://leetcode.com/problems/maximum-subarray/',
        ragContext: `### Maximum Subarray (Kadane's Algorithm) - Complete Guide

**Pattern**: Dynamic Programming / Greedy

**Kadane's Algorithm**:
1. Initialize: maxSum = nums[0], currentSum = nums[0]
2. For each element from index 1:
   - currentSum = max(nums[i], currentSum + nums[i])
   - Decision: start fresh or extend?
   - maxSum = max(maxSum, currentSum)
3. Return maxSum

**Intuition**: 
- At each position, decide: is it better to start new subarray or extend?
- If previous sum is negative, start fresh
- Track global maximum throughout

**Time Complexity**: O(n) - single pass
**Space Complexity**: O(1) - constant space

**Edge Cases**:
- All negative [-3,-2,-1] → return -1 (least negative)
- Single element [5] → return 5
- All positive [1,2,3] → return 6 (entire array)
- Mixed with zeros [0,0,0] → return 0

**Alternative: Divide and Conquer** O(n log n)
- Divide array in half
- Max subarray is in: left half, right half, or crosses middle
- Recursively solve

**Common Mistakes**:
- Initializing maxSum to 0 (fails for all-negative arrays)
- Not considering single-element subarrays
- Off-by-one errors in loop bounds

**Code Pattern**:
\`\`\`
maxSum = currentSum = nums[0]
for i in range(1, len(nums)):
    currentSum = max(nums[i], currentSum + nums[i])
    maxSum = max(maxSum, currentSum)
return maxSum
\`\`\`

**Follow-up**: Return the actual subarray, not just sum (track start/end indices)`
    },
    {
        id: 'guest-climbing-stairs',
        title: 'Climbing Stairs',
        description: `You are climbing a staircase. It takes n steps to reach the top.

Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?`,
        difficulty: 'easy',
        tags: ['Dynamic Programming', 'Math', 'Memoization'],
        hints: [
            'This is similar to Fibonacci sequence',
            'To reach step n, you either came from step n-1 or step n-2',
            'ways(n) = ways(n-1) + ways(n-2)'
        ],
        examples: [
            {
                input: 'n = 2',
                output: '2',
                explanation: 'There are two ways: (1+1) or (2)'
            },
            {
                input: 'n = 3',
                output: '3',
                explanation: 'Three ways: (1+1+1), (1+2), (2+1)'
            }
        ],
        external_url: 'https://leetcode.com/problems/climbing-stairs/',
        ragContext: `### Climbing Stairs - Complete Guide

**Pattern**: Dynamic Programming (Fibonacci variant)

**Key Insight**: 
- To reach step n, you either took 1 step from (n-1) or 2 steps from (n-2)
- Total ways = ways(n-1) + ways(n-2)
- This IS the Fibonacci sequence!

**Approach 1: Bottom-Up DP (Optimized)**:
1. Base cases: dp[1] = 1, dp[2] = 2
2. For i from 3 to n: dp[i] = dp[i-1] + dp[i-2]
3. Optimize: only keep last 2 values

**Time Complexity**: O(n)
**Space Complexity**: O(1) with optimization

**Approach 2: Recursion + Memoization**:
- Top-down with cache
- Same time complexity, O(n) space for memo

**Approach 3: Matrix Exponentiation**:
- O(log n) time for very large n
- Uses Fibonacci matrix formula

**Edge Cases**:
- n = 0 → 0 or 1 (clarify with interviewer)
- n = 1 → 1 (only one way)
- n = 2 → 2 (1+1 or 2)
- Large n → may need BigInt for very large values

**Common Mistakes**:
- Stack overflow with naive recursion
- Off-by-one in base cases
- Not handling n=1 correctly

**Optimized Code**:
\`\`\`
if n <= 2:
    return n
prev, curr = 1, 2
for i in range(3, n + 1):
    prev, curr = curr, prev + curr
return curr
\`\`\`

**Variations**:
- Climb 1, 2, or 3 steps → dp[i] = dp[i-1] + dp[i-2] + dp[i-3]
- Variable step sizes → generalize the recurrence
- Minimum cost climbing stairs → add cost consideration`
    }
];

/**
 * Get a random problem for guest users
 * Always returns a valid problem (no DB dependency)
 */
export function getGuestProblem(): Problem & { ragContext: string } {
    const randomIndex = Math.floor(Math.random() * GUEST_PROBLEMS.length);
    return GUEST_PROBLEMS[randomIndex];
}

/**
 * Get a specific guest problem by ID
 */
export function getGuestProblemById(id: string): (Problem & { ragContext: string }) | null {
    return GUEST_PROBLEMS.find(p => p.id === id) || null;
}
