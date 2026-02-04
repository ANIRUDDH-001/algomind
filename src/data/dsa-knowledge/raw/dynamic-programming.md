# Dynamic Programming

## Concept
Optimization technique that breaks problems into smaller overlapping subproblems and stores their results.

### Key Components
1. **Optimal Substructure:** Optimal solution to problem contains optimal solutions to subproblems.
2. **Overlapping Subproblems:** Same subproblems solved repeatedly.

### Approaches
1. **Top-Down (Memoization):**
   - Recursive.
   - Store result in cache map/array before returning.
   - Check cache at start of function.

2. **Bottom-Up (Tabulation):**
   - Iterative.
   - Build table from base cases up to target.
   - Often saves space (O(1) space optimization possible).

### Common Patterns

**1. 0/1 Knapsack:**
- Choice: Include item or exclude item.
- State: `dp[i][w]` max value with first `i` items and capacity `w`.

**2. Unbounded Knapsack:**
- Items can be chosen multiple times.
- E.g., Coin Change, Rod Cutting.

**3. Longest Common Subsequence:**
- `dp[i][j]` = LCS of text1[0..i] and text2[0..j].
- If chars match: `1 + dp[i-1][j-1]`
- Else: `max(dp[i-1][j], dp[i][j-1])`

**4. Palindromes:**
- Expand around center.
- `dp[i][j]` is palindrome if `s[i] == s[j]` and `dp[i+1][j-1]` is true.

**Examples:**
- Climbing Stairs
- House Robber
- Coin Change
- Longest Increasing Subsequence
