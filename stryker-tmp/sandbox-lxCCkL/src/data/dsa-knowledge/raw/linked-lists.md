# Linked Lists

## Singly Linked List
A linear data structure where each element points to the next element.

### Key Operations
- Access: O(n)
- Search: O(n)
- Insertion: O(1) (at head/tail if known reference)
- Deletion: O(1) (if node known)

### Fast & Slow Pointers (Tortoise & Hare)
A pointer algorithm used to determine properties of a linked list or cycle detection.

**Algorithm:**
- Initialize `slow` and `fast` pointers to head.
- Move `slow` by 1 step, `fast` by 2 steps.
- If they meet, there is a cycle.

**Finding Middle:**
- When `fast` reaches end, `slow` is at middle.

**Examples:**
- Detect Cycle in Linked List
- Middle of Linked List
- Palindrome Linked List

### In-Place Reversal of Linked List
Reversing the links between nodes without using extra space.

**Algorithm:**
- Maintain `prev`, `curr`, `next`.
- Loop while `curr` is not null:
  - `next = curr.next`
  - `curr.next = prev`
  - `prev = curr`
  - `curr = next`
- Return `prev` as new head.

**Examples:**
- Reverse Linked List
- Reverse Linked List II (sub-list)
- Reverse Nodes in k-Group
