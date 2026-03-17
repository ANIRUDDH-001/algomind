# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - img [ref=e8]
        - heading "Welcome to AlgoMind" [level=1] [ref=e16]
        - paragraph [ref=e17]: Sign in to track your DSA interview progress
      - generic [ref=e18]:
        - button "Continue with Google" [ref=e19]:
          - img [ref=e20]
          - text: Continue with Google
        - button "Continue with GitHub" [ref=e25]:
          - img [ref=e26]
          - text: Continue with GitHub
      - paragraph [ref=e28]:
        - text: By continuing you agree to our
        - link "Terms of Service" [ref=e29] [cursor=pointer]:
          - /url: "#"
  - region "Notifications alt+T"
  - button "Open Next.js Dev Tools" [ref=e35] [cursor=pointer]:
    - img [ref=e36]
  - alert [ref=e39]
```