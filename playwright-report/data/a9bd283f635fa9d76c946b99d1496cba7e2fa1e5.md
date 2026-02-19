# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - img [ref=e5]
    - heading "Something went wrong" [level=2] [ref=e7]
    - paragraph [ref=e8]: object is not iterable (cannot read property Symbol(Symbol.iterator))
    - group [ref=e9]:
      - generic "Show error details" [ref=e10] [cursor=pointer]
    - generic [ref=e11]:
      - button "Reload" [ref=e12]:
        - img [ref=e13]
        - text: Reload
      - button "Go Home" [ref=e18]:
        - img [ref=e19]
        - text: Go Home
  - generic [ref=e26] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e27]:
      - img [ref=e28]
    - generic [ref=e31]:
      - button "Open issues overlay" [ref=e32]:
        - generic [ref=e33]:
          - generic [ref=e34]: "0"
          - generic [ref=e35]: "1"
        - generic [ref=e36]: Issue
      - button "Collapse issues badge" [ref=e37]:
        - img [ref=e38]
  - alert [ref=e40]
```