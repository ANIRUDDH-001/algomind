# Complexity Analysis

## Time Complexity

Time complexity measures how runtime scales with input size n.

### Common Complexities (Best to Worst)

| Complexity | Name | Example |
|------------|------|---------|
| O(1) | Constant | Array access, hash lookup |
| O(log n) | Logarithmic | Binary search |
| O(n) | Linear | Single loop, linear search |
| O(n log n) | Linearithmic | Merge sort, heap sort |
| O(n²) | Quadratic | Nested loops, bubble sort |
| O(2^n) | Exponential | Subsets, Fibonacci naive |
| O(n!) | Factorial | Permutations |

### Analysis Tips

- Drop constants: O(2n) → O(n)
- Drop lower order terms: O(n² + n) → O(n²)
- Different inputs use different variables: O(m + n) not O(n)

### Loop Analysis

```python
# O(n) - single loop
for i in range(n):
    do_something()

# O(n²) - nested loops
for i in range(n):
    for j in range(n):
        do_something()

# O(n log n) - loop with halving
for i in range(n):
    j = n
    while j > 0:
        j //= 2  # Halving → log n

# O(log n) - halving only
i = n
while i > 0:
    i //= 2
```

## Space Complexity

Space complexity measures extra memory used beyond input storage.

### Common Space Complexities

| Complexity | Example |
|------------|---------|
| O(1) | Fixed variables, in-place algorithms |
| O(log n) | Balanced tree recursion depth |
| O(n) | Additional array, hash map |
| O(n²) | 2D matrix |

### Input vs Auxiliary Space

- **Input space**: Memory for input (don't count)
- **Auxiliary space**: Extra space used by algorithm (count this)
- Space complexity = Auxiliary space

### Recursion Call Stack

Each recursive call uses stack space.
Depth of recursion = space complexity.

```python
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)  # Stack depth O(n)
```

## Space-Time Tradeoffs

### Memoization (Trade Space for Time)
- Store results → Use O(n) space
- Avoid recomputation → Save time
- Example: Fibonacci O(2^n) → O(n) with memo

### Hash Map (Trade Space for Time)
- Store seen elements → O(n) space
- O(1) lookup → Fast time
- Example: Two Sum O(n²) → O(n)

## Best, Average, Worst Case

| Algorithm | Best | Average | Worst |
|-----------|------|---------|-------|
| Quick sort | O(n log n) | O(n log n) | O(n²) |
| Hash map | O(1) | O(1) | O(n) |
| Binary search | O(1) | O(log n) | O(log n) |
