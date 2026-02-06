# Dynamic Programming

## Core Concept

Dynamic Programming solves problems by breaking them into overlapping subproblems and storing results to avoid recomputation.

### Two Key Properties
1. **Overlapping Subproblems**: Same subproblem computed multiple times
2. **Optimal Substructure**: Optimal solution contains optimal solutions to subproblems

## Memoization (Top-Down)

Solve recursively while caching results.

```python
def fib_memo(n, memo=None):
    if memo is None:
        memo = {}
    
    if n <= 1:
        return n
    
    if n in memo:
        return memo[n]
    
    memo[n] = fib_memo(n-1, memo) + fib_memo(n-2, memo)
    return memo[n]
```

**Advantages:**
- Only computes needed subproblems
- Easy to convert from recursive solution
- Natural for some problems (tree DP)

**Disadvantages:**
- Recursion depth limits (Python ~1000)
- Extra space for call stack
- Slightly slower (function call overhead)

## Tabulation (Bottom-Up)

Fill a table iteratively starting from base cases.

```python
def fib_tab(n):
    if n <= 1:
        return n
    
    dp = [0] * (n + 1)
    dp[1] = 1
    
    for i in range(2, n + 1):
        dp[i] = dp[i-1] + dp[i-2]
    
    return dp[n]
```

**Advantages:**
- No recursion depth issues
- Faster (no function call overhead)
- Easier to optimize space

**Disadvantages:**
- Less intuitive for some problems
- Computes ALL subproblems (even unneeded)

## Space Optimization

Many DP problems can reduce space complexity.

### 1D → O(1) with Rolling Variables
```python
def fib_optimized(n):
    if n <= 1:
        return n
    
    prev2, prev1 = 0, 1
    for _ in range(2, n + 1):
        current = prev1 + prev2
        prev2, prev1 = prev1, current
    
    return prev1
```

### 2D → O(n) with Rolling Array
When dp[i][j] only depends on dp[i-1][...], use single row.

## Common Patterns

### 1. Fibonacci-Type
Each state depends on fixed previous states.
- Climbing Stairs, House Robber

### 2. Knapsack-Type
Choose items with constraints.
- 0/1 Knapsack, Coin Change

### 3. String-Type
Compare/transform strings.
- Longest Common Subsequence, Edit Distance

### 4. Decision-Type
Make optimal choices at each step.
- Best Time to Buy/Sell Stock

## DP Template
```python
def dp_solution(input):
    # 1. Define state: dp[i] = ...
    # 2. Initialize base cases
    # 3. Define recurrence relation
    # 4. Fill table in correct order
    # 5. Return answer
    pass
```
