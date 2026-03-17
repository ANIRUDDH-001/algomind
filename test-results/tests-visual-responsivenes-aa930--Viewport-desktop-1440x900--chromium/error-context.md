# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e5]:
        - button "AlgoMind Logo AlgoMind" [ref=e6]:
          - img "AlgoMind Logo" [ref=e7]
          - generic [ref=e8]: AlgoMind
        - generic [ref=e9]:
          - link "Home" [ref=e10] [cursor=pointer]:
            - /url: /
            - text: Home
          - link "Practice" [ref=e12] [cursor=pointer]:
            - /url: /practice
          - link "Learn" [ref=e13] [cursor=pointer]:
            - /url: /learn
        - button "Sign In" [ref=e15]
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e23]: A
      - heading "AlgoMind" [level=1] [ref=e30]
      - generic [ref=e31]:
        - generic [ref=e32]: Arrays
        - generic [ref=e33]: Trees
        - generic [ref=e34]: Graphs
        - generic [ref=e35]: Dynamic Programming
        - generic [ref=e36]: Recursion
        - generic [ref=e37]: Sorting
      - paragraph [ref=e38]: AI-Powered DSA Interview Practice
      - button "Start Practicing" [ref=e40]
      - button "Skip (ESC / Space / Enter) →" [ref=e41]
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e47] [cursor=pointer]:
    - img [ref=e48]
  - alert [ref=e51]
```