# Hashing & Hash Maps

## Frequency Counting Pattern

Hash maps provide O(1) average lookup/insert for tracking element frequencies and groupings.

### Pattern 1: Frequency Counting
```python
from collections import defaultdict
freq = defaultdict(int)
for item in array:
    freq[item] += 1
# Now: freq[x] = how many times x appears
```

### Pattern 2: Grouping by Property
```python
groups = defaultdict(list)
for item in array:
    key = compute_hash(item)  # e.g., sorted(string)
    groups[key].append(item)
```

### Pattern 3: Seen/Not Seen Tracking
```python
seen = set()  # or dict for index tracking
for i, item in enumerate(array):
    if item in seen:
        # Found duplicate
    seen.add(item)
```

## Common Applications

### Two Sum Pattern
Map value → index, check if (target - current) exists.
- Time: O(n), Space: O(n)
- Key insight: Trade space for time vs brute force O(n²)

### Group Anagrams
Map sorted_string → [anagrams].
- Sort each string as key: O(n * k log k)
- Or use character count tuple as key: O(n * k)

### Top K Frequent Elements
Count frequencies, then heap or sort.
- With heap: O(n log k)
- With bucket sort: O(n)

### First Unique Character
Two passes - count, then find first with count=1.
- Time: O(n), Space: O(1) if alphabet is fixed

## Trade-offs

**Advantages:**
- O(1) average case operations
- Flexible key types
- Easy to implement

**Disadvantages:**
- O(n) worst case (hash collisions)
- No ordering preserved
- Extra space required

## Python Built-ins
- `collections.Counter`: Frequency counting
- `collections.defaultdict`: Auto-initialization
- `set()`: Uniqueness checks
- `dict.get(key, default)`: Safe access
