# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e5]:
        - button "AlgoMind Logo AlgoMind" [ref=e6]:
          - img "AlgoMind Logo" [ref=e7]
          - generic [ref=e8]: AlgoMind
        - button "Sign In" [ref=e10]
  - navigation [ref=e11]:
    - generic [ref=e13]:
      - link "Home" [ref=e14] [cursor=pointer]:
        - /url: /
        - img [ref=e16]
        - generic [ref=e19]: Home
      - link "Practice" [ref=e21] [cursor=pointer]:
        - /url: /practice
        - img [ref=e23]
        - generic [ref=e25]: Practice
  - main [ref=e27]:
    - generic [ref=e28]:
      - generic [ref=e33]: A
      - heading "AlgoMind" [level=1] [ref=e40]
      - generic [ref=e41]:
        - generic [ref=e42]: Arrays
        - generic [ref=e43]: Trees
        - generic [ref=e44]: Graphs
        - generic [ref=e45]: Dynamic Programming
        - generic [ref=e46]: Recursion
        - generic [ref=e47]: Sorting
      - paragraph [ref=e48]: AI-Powered DSA Interview Practice
      - button "Start Practicing" [ref=e50]
      - button "Skip (ESC / Space / Enter) →" [ref=e51]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e57] [cursor=pointer]:
    - img [ref=e58]
  - alert [ref=e61]
```