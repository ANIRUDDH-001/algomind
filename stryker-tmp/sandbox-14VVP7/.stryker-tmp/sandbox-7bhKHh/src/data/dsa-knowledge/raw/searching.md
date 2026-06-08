# Searching Algorithms

## Binary Search

Binary search finds target in sorted array by repeatedly halving search space.

### Standard Template
```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = left + (right - left) // 2  # Avoid overflow
        
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1  # Not found
```

**Time Complexity:** O(log n)
**Space Complexity:** O(1)

### Why `(right - left) // 2`?
Prevents integer overflow in languages like C++/Java.
Same as `(left + right) // 2` but safer.

## Variations

### Find First Occurrence
```python
def find_first(arr, target):
    left, right = 0, len(arr) - 1
    result = -1
    
    while left <= right:
        mid = left + (right - left) // 2
        
        if arr[mid] == target:
            result = mid
            right = mid - 1  # Continue searching left
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return result
```

### Find Insert Position
```python
def search_insert(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = left + (right - left) // 2
        
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return left  # Insert position
```

### Binary Search on Answer Space
```python
def minimize_max(arr, k):
    def feasible(threshold):
        # Check if solution exists with this threshold
        return count <= k
    
    left, right = min(arr), max(arr)
    
    while left < right:
        mid = left + (right - left) // 2
        if feasible(mid):
            right = mid  # Try smaller
        else:
            left = mid + 1
    
    return left
```

## Common Mistakes

1. Using `left < right` vs `left <= right` (affects termination)
2. Infinite loop (not updating left/right properly)
3. Off-by-one errors (test with single element)

## Applications Beyond Sorted Arrays

- Rotated sorted array
- Peak finding
- Square root calculation
- Minimizing/maximizing some value
- Search in 2D sorted matrix
