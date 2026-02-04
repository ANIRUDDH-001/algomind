# Trees & Graphs

## Binary Trees
A hierarchical structure where each node has at most two children.

### Traversal Algorithms (DFS)
- **Pre-order:** Root -> Left -> Right
- **In-order:** Left -> Root -> Right (Sorted for BST)
- **Post-order:** Left -> Right -> Root

### Breadth First Search (BFS)
Level-order traversal using a Queue.

**Algorithm:**
- Push root to queue.
- While queue not empty:
  - Dequeue node, process it.
  - Enqueue left child.
  - Enqueue right child.

**Examples:**
- Level Order Traversal
- Right Side View
- Zigzag Level Order Traversal

## Binary Search Tree (BST)
A binary tree where left child < root < right child.
- Search/Insert/Delete: O(log n) average.

## Graphs
Nodes connected by edges. Can be directed/undirected, weighted/unweighted.

### Depth First Search (DFS)
Explore as deep as possible before backtracking.
- Use Stack or Recursion.
- Keep `visited` set to avoid cycles.

**Use Cases:**
- Finding connected components
- Topological Sort
- Cycle detection

### Breadth First Search (BFS)
Explore neighbors first.
- Use Queue.
- Finds Shortest Path in unweighted graph.

**Use Cases:**
- Shortest Path in Binary Matrix
- Level of check
- Social Network Connections
