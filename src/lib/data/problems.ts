export interface Problem {
    id: string;
    title: string;
    difficulty: 'easy' | 'medium' | 'hard';
    description: string;
    category: string;
}

export const PROBLEMS: Problem[] = [
    {
        id: 'invert-binary-tree',
        title: 'Invert Binary Tree',
        difficulty: 'easy',
        category: 'Trees',
        description: `Given the root of a binary tree, invert the tree, and return its root.

Example 1:
Input: root = [4,2,7,1,3,6,9]
Output: [4,7,2,9,6,3,1]

Example 2:
Input: root = [2,1,3]
Output: [2,3,1]

Constraints:
- The number of nodes in the tree is in the range [0, 100].
- -100 <= Node.val <= 100`
    },
    {
        id: 'two-sum',
        title: 'Two Sum',
        difficulty: 'easy',
        category: 'Arrays',
        description: `Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
You may assume that each input would have exactly one solution, and you may not use the same element twice.
You can return the answer in any order.

Example 1:
Input: nums = [2,7,11,15], target = 9
Output: [0,1]
Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].

Example 2:
Input: nums = [3,2,4], target = 6
Output: [1,2]`
    },
    {
        id: 'lru-cache',
        title: 'LRU Cache',
        difficulty: 'medium',
        category: 'Design',
        description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache.

Implement the LRUCache class:
- LRUCache(int capacity) Initialize the LRU cache with positive size capacity.
- int get(int key) Return the value of the key if the key exists, otherwise return -1.
- void put(int key, int value) Update the value of the key if the key exists. Otherwise, add the key-value pair to the cache. If the number of keys exceeds the capacity from this operation, evict the least recently used key.

The functions get and put must each run in O(1) average time complexity.`
    },
    {
        id: 'longest-substring-no-repeat',
        title: 'Longest Substring Without Repeating Characters',
        difficulty: 'medium',
        category: 'Strings',
        description: `Given a string s, find the length of the longest substring without repeating characters.

Example 1:
Input: s = "abcabcbb"
Output: 3
Explanation: The answer is "abc", with the length of 3.

Example 2:
Input: s = "bbbbb"
Output: 1
Explanation: The answer is "b", with the length of 1.`
    }
];

export function getRandomProblem(): Problem {
    return PROBLEMS[Math.floor(Math.random() * PROBLEMS.length)];
}

export function getProblemById(id: string): Problem | undefined {
    return PROBLEMS.find(p => p.id === id);
}
