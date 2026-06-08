# Recursion & Backtracking

## Backtracking Template

Backtracking explores all possible solutions by trying choices and undoing (backtracking) when they lead to dead ends.

```python
def backtrack(state, choices, result):
    # Base case: found valid solution
    if is_solution(state):
        result.append(state.copy())  # MUST COPY
        return
    
    # Try each choice
    for choice in choices:
        # Make choice
        state.add(choice)
        
        # Recurse with updated state
        backtrack(state, remaining_choices, result)
        
        # Undo choice (backtrack)
        state.remove(choice)
```

## Key Concepts

- **Choice**: Decision at current step
- **Constraint**: Rules limiting choices
- **Goal**: Condition for valid solution
- **Backtrack**: Undo choice and try next

## Permutations

```python
def permute(nums):
    result = []
    
    def backtrack(path, remaining):
        if not remaining:
            result.append(path[:])  # Copy!
            return
        
        for i in range(len(remaining)):
            path.append(remaining[i])
            backtrack(path, remaining[:i] + remaining[i+1:])
            path.pop()
    
    backtrack([], nums)
    return result
```

Time Complexity: O(n!)

## Combinations

```python
def combine(n, k):
    result = []
    
    def backtrack(start, path):
        if len(path) == k:
            result.append(path[:])
            return
        
        for i in range(start, n + 1):
            path.append(i)
            backtrack(i + 1, path)  # Next starts from i+1
            path.pop()
    
    backtrack(1, [])
    return result
```

Time Complexity: O(C(n,k))

## Subsets

```python
def subsets(nums):
    result = []
    
    def backtrack(start, path):
        result.append(path[:])  # Every state is valid
        
        for i in range(start, len(nums)):
            path.append(nums[i])
            backtrack(i + 1, path)
            path.pop()
    
    backtrack(0, [])
    return result
```

Time Complexity: O(2^n)

## Optimization Techniques

1. **Early termination** (prune branches)
2. **Constraint checking** before recursion
3. **Memoization** (if overlapping subproblems)
4. **Sorting** to enable pruning
