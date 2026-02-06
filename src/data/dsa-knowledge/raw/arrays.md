# Arrays & Hashing

## Two Pointer Technique

The two-pointer pattern involves using two pointers to iterate through the data structure, typically one starting from the beginning and the other from the end, or both moving at different speeds.

### Pattern 1: Opposite Ends
Initialize left=0, right=n-1, move toward center.
- Use case: Finding pairs that sum to target in SORTED array
- Examples: Two Sum II, Container With Most Water
- Time: O(n), Space: O(1)

```python
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    
    while left < right:
        current_sum = nums[left] + nums[right]
        
        if current_sum == target:
            return [left, right]
        elif current_sum < target:
            left += 1
        else:
            right -= 1
    
    return []
```

### Pattern 2: Fast-Slow (Tortoise and Hare)
Two pointers moving at different speeds.
- Use case: Detecting cycles, finding middle element
- Examples: Linked List Cycle, Remove Nth Node
- Time: O(n), Space: O(1)

### Pattern 3: Same Direction
Both move forward, maintaining window.
- Use case: Removing duplicates, partitioning
- Examples: Remove Duplicates, Move Zeroes
- Time: O(n), Space: O(1)

### When to Use Two Pointers
- Array is sorted or can be sorted
- Looking for pairs/triplets with specific property
- Need O(1) space complexity
- Alternative to nested loops (reduce O(n²) to O(n))

### Common Mistakes
- Forgetting to handle edge cases (empty array, single element)
- Not considering when pointers cross
- Using on unsorted arrays without sorting first

## Sliding Window

Sliding window maintains a subset of elements (window) and slides it across the array to find optimal subarrays.

### Fixed-Size Window
```python
def max_sum_k_elements(nums, k):
    # Calculate sum of first k elements
    window_sum = sum(nums[:k])
    max_sum = window_sum
    
    # Slide window
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        max_sum = max(max_sum, window_sum)
    
    return max_sum
```
Time: O(n), Space: O(1)

### Variable-Size Window
```python
def longest_substring_k_distinct(s, k):
    left = 0
    char_count = {}
    max_length = 0
    
    for right in range(len(s)):
        # Expand: add right character
        char_count[s[right]] = char_count.get(s[right], 0) + 1
        
        # Shrink: remove left characters until valid
        while len(char_count) > k:
            char_count[s[left]] -= 1
            if char_count[s[left]] == 0:
                del char_count[s[left]]
            left += 1
        
        max_length = max(max_length, right - left + 1)
    
    return max_length
```
Time: O(n), Space: O(k)

### When to Use Sliding Window
- Problems with "contiguous" or "consecutive" subarray/substring
- Finding max/min of some property over windows
- Problems asking for longest/shortest subarray with condition

## Hashing

Using a hash function to map keys to values for O(1) average case lookup.

### Frequency Counter Pattern
```python
from collections import Counter

def has_duplicate(nums):
    freq = Counter(nums)
    return any(count > 1 for count in freq.values())
```

### Prefix Sum
An array where prefix[i] contains the sum of array elements from 0 to i.
Range Sum query (i, j) = prefix[j] - prefix[i-1].

```python
def prefix_sum(nums):
    prefix = [0] * (len(nums) + 1)
    for i, num in enumerate(nums):
        prefix[i + 1] = prefix[i] + num
    
    # Range sum from i to j (inclusive)
    def range_sum(i, j):
        return prefix[j + 1] - prefix[i]
    
    return range_sum
```
