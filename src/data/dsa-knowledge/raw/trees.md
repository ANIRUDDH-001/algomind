# Trees

## Tree Traversals

### Depth-First Traversals

#### Inorder (Left-Root-Right)
BST property: Returns sorted order.

```python
def inorder(root):
    if not root:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)

# Iterative version
def inorder_iterative(root):
    stack = []
    result = []
    current = root
    
    while current or stack:
        while current:
            stack.append(current)
            current = current.left
        
        current = stack.pop()
        result.append(current.val)
        current = current.right
    
    return result
```

#### Preorder (Root-Left-Right)
Use case: Copying tree, prefix expression, serialization.

```python
def preorder(root):
    if not root:
        return []
    return [root.val] + preorder(root.left) + preorder(root.right)
```

#### Postorder (Left-Right-Root)
Use case: Deleting tree, postfix expression, calculating heights.

```python
def postorder(root):
    if not root:
        return []
    return postorder(root.left) + postorder(root.right) + [root.val]
```

### Breadth-First (Level-Order)

```python
from collections import deque

def levelorder(root):
    if not root:
        return []
    
    result = []
    queue = deque([root])
    
    while queue:
        level_size = len(queue)
        level = []
        
        for _ in range(level_size):
            node = queue.popleft()
            level.append(node.val)
            
            if node.left:
                queue.append(node.left)
            if node.right:
                queue.append(node.right)
        
        result.append(level)
    
    return result
```

Use case: Level-by-level processing, shortest path in tree, right side view.

## Binary Search Tree (BST)

BST Property: For every node, all values in left subtree < node.val < all values in right subtree.

### Search: O(log n) average, O(n) worst
```python
def search_bst(root, target):
    if not root:
        return None
    
    if target == root.val:
        return root
    elif target < root.val:
        return search_bst(root.left, target)
    else:
        return search_bst(root.right, target)
```

### Insert: O(log n) average
```python
def insert_bst(root, val):
    if not root:
        return TreeNode(val)
    
    if val < root.val:
        root.left = insert_bst(root.left, val)
    else:
        root.right = insert_bst(root.right, val)
    
    return root
```

### Validate BST
```python
def is_valid_bst(root, min_val=float('-inf'), max_val=float('inf')):
    if not root:
        return True
    
    if root.val <= min_val or root.val >= max_val:
        return False
    
    return (is_valid_bst(root.left, min_val, root.val) and
            is_valid_bst(root.right, root.val, max_val))
```

## Complexity Analysis

All traversals:
- Time: O(n) - visit each node once
- Space: O(h) for call stack (h = height)
- Worst case: O(n) for skewed tree
- Best case: O(log n) for balanced tree
