/**
 * @codesage
 * @file      src/app/learn/[slug]/topic-data.ts
 * @purpose   Provides static reference data (descriptions and code snippets) for algorithmic topics.
 * @tech      TypeScript
 * @connects  Exported for use in LearnSessionPageClient
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

export interface TopicData {
  description: string;
  referenceCode: string;
}

export const TOPIC_DATA: Record<string, TopicData> = {
  'arrays-strings': {
    description: "Master sequential data structures. Learn how to traverse, modify, and optimize operations on arrays and strings.",
    referenceCode: `// Reverse a string in-place
public void reverseString(char[] s) {
    int left = 0, right = s.length - 1;
    while (left < right) {
        char temp = s[left];
        s[left] = s[right];
        s[right] = temp;
        left++;
        right--;
    }
}`
  },
  'hashmaps-sets': {
    description: "Understand constant-time lookups. Learn to use hash maps and sets for frequency counting and fast data retrieval.",
    referenceCode: `// Two Sum using HashMap
public int[] twoSum(int[] nums, int target) {
    Map<Integer, Integer> map = new HashMap<>();
    for (int i = 0; i < nums.length; i++) {
        int complement = target - nums[i];
        if (map.containsKey(complement)) {
            return new int[] { map.get(complement), i };
        }
        map.put(nums[i], i);
    }
    return new int[] {};
}`
  },
  'two-pointers': {
    description: "Optimize array and string processing by maintaining two pointers to avoid nested loops.",
    referenceCode: `// Remove duplicates from sorted array
public int removeDuplicates(int[] nums) {
    if (nums.length == 0) return 0;
    int slow = 0;
    for (int fast = 1; fast < nums.length; fast++) {
        if (nums[fast] != nums[slow]) {
            slow++;
            nums[slow] = nums[fast];
        }
    }
    return slow + 1;
}`
  },
  'sliding-window': {
    description: "Solve subarray and substring problems efficiently by maintaining a window that expands and contracts.",
    referenceCode: `// Maximum sum subarray of size k
public int maxSumSubarray(int[] nums, int k) {
    int maxSum = 0, windowSum = 0;
    for (int i = 0; i < nums.length; i++) {
        windowSum += nums[i];
        if (i >= k - 1) {
            maxSum = Math.max(maxSum, windowSum);
            windowSum -= nums[i - (k - 1)];
        }
    }
    return maxSum;
}`
  },
  'binary-search': {
    description: "Master O(log N) search algorithms. Learn to find targets in sorted arrays or search spaces.",
    referenceCode: `// Standard Binary Search
public int binarySearch(int[] nums, int target) {
    int left = 0;
    int right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}`
  },
  'recursion-backtracking': {
    description: "Solve complex combinatorial problems by exploring all possible states and abandoning invalid paths.",
    referenceCode: `// Generate all subsets (Power Set)
public void backtrack(List<List<Integer>> res, List<Integer> curr, int[] nums, int start) {
    res.add(new ArrayList<>(curr));
    for (int i = start; i < nums.length; i++) {
        curr.add(nums[i]);
        backtrack(res, curr, nums, i + 1);
        curr.remove(curr.size() - 1);
    }
}`
  },
  'trees-traversal': {
    description: "Navigate hierarchical data structures using Depth-First Search (DFS) and Breadth-First Search (BFS).",
    referenceCode: `// Inorder Traversal of Binary Tree
public void inorder(TreeNode root, List<Integer> res) {
    if (root == null) return;
    inorder(root.left, res);
    res.add(root.val);
    inorder(root.right, res);
}`
  },
  'graphs-bfs-dfs': {
    description: "Model relationships and networks. Learn to traverse graphs to find paths and connected components.",
    referenceCode: `// Graph BFS Traversal
public void bfs(int startNode, Map<Integer, List<Integer>> graph) {
    Set<Integer> visited = new HashSet<>();
    Queue<Integer> queue = new LinkedList<>();
    queue.offer(startNode);
    visited.add(startNode);
    
    while (!queue.isEmpty()) {
        int node = queue.poll();
        for (int neighbor : graph.getOrDefault(node, new ArrayList<>())) {
            if (!visited.contains(neighbor)) {
                visited.add(neighbor);
                queue.offer(neighbor);
            }
        }
    }
}`
  },
  'dynamic-programming': {
    description: "Break down complex problems into overlapping subproblems. Trade space for time with memoization and tabulation.",
    referenceCode: `// Fibonacci Sequence (Bottom-Up Tabulation)
public int fib(int n) {
    if (n <= 1) return n;
    int[] dp = new int[n + 1];
    dp[0] = 0; dp[1] = 1;
    for (int i = 2; i <= n; i++) {
        dp[i] = dp[i - 1] + dp[i - 2];
    }
    return dp[n];
}`
  },
  'heaps': {
    description: "Master priority queues. Learn to efficiently access the minimum or maximum element in a dynamic collection.",
    referenceCode: `// Find Kth Largest Element using Min-Heap
public int findKthLargest(int[] nums, int k) {
    PriorityQueue<Integer> minHeap = new PriorityQueue<>();
    for (int num : nums) {
        minHeap.offer(num);
        if (minHeap.size() > k) {
            minHeap.poll(); // remove smallest
        }
    }
    return minHeap.peek();
}`
  },
  'tries': {
    description: "Optimize prefix matching and string lookups using a tree-like data structure.",
    referenceCode: `// Trie Insert Operation
class TrieNode {
    TrieNode[] children = new TrieNode[26];
    boolean isWord = false;
}

public void insert(TrieNode root, String word) {
    TrieNode curr = root;
    for (char c : word.toCharArray()) {
        if (curr.children[c - 'a'] == null) {
            curr.children[c - 'a'] = new TrieNode();
        }
        curr = curr.children[c - 'a'];
    }
    curr.isWord = true;
}`
  },
  'sorting-algorithms': {
    description: "Understand the mechanics of different sorting algorithms and their time/space complexities.",
    referenceCode: `// Merge Sort Implementation
public void mergeSort(int[] arr, int left, int right) {
    if (left < right) {
        int mid = left + (right - left) / 2;
        mergeSort(arr, left, mid);
        mergeSort(arr, mid + 1, right);
        merge(arr, left, mid, right);
    }
}`
  },
  'linked-lists': {
    description: "Master pointer manipulation in sequential data structures without contiguous memory allocation.",
    referenceCode: `// Reverse a Linked List
public ListNode reverseList(ListNode head) {
    ListNode prev = null;
    ListNode curr = head;
    while (curr != null) {
        ListNode nextTemp = curr.next;
        curr.next = prev;
        prev = curr;
        curr = nextTemp;
    }
    return prev;
}`
  },
  'bit-manipulation': {
    description: "Optimize operations at the hardware level using bitwise operators like AND, OR, XOR, and shifts.",
    referenceCode: `// Find the Single Number (using XOR)
public int singleNumber(int[] nums) {
    int res = 0;
    for (int num : nums) {
        res ^= num; // a ^ a = 0, a ^ 0 = a
    }
    return res;
}`
  },
  'math-number-theory': {
    description: "Leverage mathematical properties, primes, and modular arithmetic to solve computational problems.",
    referenceCode: `// Sieve of Eratosthenes (Find Primes up to N)
public boolean[] sieve(int n) {
    boolean[] isPrime = new boolean[n + 1];
    Arrays.fill(isPrime, true);
    isPrime[0] = false; isPrime[1] = false;
    for (int p = 2; p * p <= n; p++) {
        if (isPrime[p]) {
            for (int i = p * p; i <= n; i += p)
                isPrime[i] = false;
        }
    }
    return isPrime;
}`
  },
  'stack-queue': {
    description: "Manage data with LIFO (Last-In-First-Out) stacks and FIFO (First-In-First-Out) queues.",
    referenceCode: `// Valid Parentheses using Stack
public boolean isValid(String s) {
    Stack<Character> stack = new Stack<>();
    for (char c : s.toCharArray()) {
        if (c == '(') stack.push(')');
        else if (c == '{') stack.push('}');
        else if (c == '[') stack.push(']');
        else if (stack.isEmpty() || stack.pop() != c) return false;
    }
    return stack.isEmpty();
}`
  },
  'intervals': {
    description: "Solve problems involving overlapping ranges and scheduling by sorting and merging intervals.",
    referenceCode: `// Merge Intervals
public int[][] merge(int[][] intervals) {
    Arrays.sort(intervals, (a, b) -> Integer.compare(a[0], b[0]));
    List<int[]> res = new ArrayList<>();
    int[] current = intervals[0];
    res.add(current);
    for (int[] interval : intervals) {
        if (interval[0] <= current[1]) {
            current[1] = Math.max(current[1], interval[1]);
        } else {
            current = interval;
            res.add(current);
        }
    }
    return res.toArray(new int[res.size()][]);
}`
  },
  'matrix': {
    description: "Navigate and manipulate 2D grids. Master multi-dimensional array traversals and transformations.",
    referenceCode: `// Rotate Image / Matrix by 90 Degrees
public void rotate(int[][] matrix) {
    int n = matrix.length;
    // Transpose
    for (int i = 0; i < n; i++) {
        for (int j = i; j < n; j++) {
            int temp = matrix[i][j];
            matrix[i][j] = matrix[j][i];
            matrix[j][i] = temp;
        }
    }
    // Reverse each row
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n / 2; j++) {
            int temp = matrix[i][j];
            matrix[i][j] = matrix[i][n - 1 - j];
            matrix[i][n - 1 - j] = temp;
        }
    }
}`
  },
  'prefix-sum': {
    description: "Optimize range sum queries by precomputing cumulative sums in linear time.",
    referenceCode: `// Prefix Sum Array Construction
public int[] buildPrefixSum(int[] nums) {
    int[] prefix = new int[nums.length + 1];
    for (int i = 0; i < nums.length; i++) {
        prefix[i + 1] = prefix[i] + nums[i];
    }
    return prefix;
}
// Query sum of range [L, R]: prefix[R + 1] - prefix[L]`
  },
  'union-find': {
    description: "Efficiently group elements into disjoint sets and check connectivity using Union-Find (Disjoint Set Union).",
    referenceCode: `// Union-Find with Path Compression & Rank
class UnionFind {
    int[] parent, rank;
    public UnionFind(int n) {
        parent = new int[n]; rank = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    public int find(int i) {
        if (parent[i] != i) parent[i] = find(parent[i]); // Path compression
        return parent[i];
    }
    public void union(int i, int j) {
        int rootI = find(i), rootJ = find(j);
        if (rootI != rootJ) {
            if (rank[rootI] < rank[rootJ]) parent[rootI] = rootJ;
            else if (rank[rootI] > rank[rootJ]) parent[rootJ] = rootI;
            else { parent[rootJ] = rootI; rank[rootI]++; }
        }
    }
}`
  }
};
