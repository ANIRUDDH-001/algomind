# Arrays & Hashing

## Arrays
An array is a collection of items of same data type stored at contiguous memory locations.

### Key Operations
- Access: O(1)
- Search: O(n)
- Insertion: O(n)
- Deletion: O(n)

### Two Pointer Technique
The two pointer pattern involves using two pointers to iterate through the data structure, typically one starting from the beginning and the other from the end, or both moving at different speeds.

**Common Use Cases:**
1. **Sorted Arrays:** Finding a pair that sums to a target.
   - Initialize left=0, right=n-1.
   - If sum < target, increment left.
   - If sum > target, decrement right.
2. **Remove Duplicates:** Modify array in-place.
3. **Container With Most Water:** Find max area.

**Time Complexity:** O(n)
**Space Complexity:** O(1)

### Sliding Window
Used to perform required operation on a specific window size of a given array or string.

**Fixed Size:**
- Calculate sum of first k elements.
- Slide window one step forward: subtract element leaving, add element entering.

**Variable Size:**
- Expand window (right pointer) until condition is met.
- Shrink window (left pointer) until valid again.
- Keep track of min/max window size.

**Examples:**
- Longest Substring Without Repeating Characters
- Max Consecutive Ones III
- Minimum Window Substring

## Hashing
Using a hash function to map keys to values for O(1) average case lookup.

### Hash Map (Dictionary)
Stores key-value pairs. Essential for counting frequencies or caching results.

**Patterns:**
- **Two Sum:** Store `target - current` in map.
- **Group Anagrams:** Sort string as key or use char count array.
- **Frequency Counter:** Count occurrences of elements.

### Prefix Sum
An array where `prefix[i]` contains the sum of array elements from `0` to `i`.
Range Sum query `(i, j)` = `prefix[j] - prefix[i-1]`.
