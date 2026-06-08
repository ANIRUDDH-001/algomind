# E2E Test Infra: AlgoMind Swipe Gestures

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Candidate Dashboard Tab Swiping | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Owner Dashboard Tab Swiping | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 3 | Block Swiping on Interview Session | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 4 | Employer Submissions Action Cards | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 5 | Admin User Grid Action Cards | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 6 | Mobile Modals Swipe-to-Dismiss | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | Main Dashboard Vertical Scrolling | Parent Update | 5 | 5 | ✓ |

## Test Architecture
- Test runner: Playwright (`npx playwright test tests/e2e/swipe-gestures.spec.ts`)
- Test case format: Playwright E2E tests simulating touch actions (e.g. `page.mouse.move`, `page.mouse.down`, `page.mouse.up` with `page.emulateMedia({ media: 'screen' })` or using `page.touchscreen.tap` / dragging).
- Directory layout: `tests/e2e/swipe-gestures.spec.ts`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Candidate swiping across tabs, opening transcript modal, and dismissing it | 1, 6 | Medium |
| 2 | Employer swiping submissions to reveal details, then checking candidate views | 4, 1 | Medium |
| 3 | Admin swiping user grid to configure users, then using owner tabs | 5, 2 | Medium |
| 4 | Owner managing config tabs via swipe and encountering mobile modals | 2, 6 | Medium |
| 5 | Candidate entering interview session, verifying swipe is blocked, then leaving | 3, 1 | Medium |

## Coverage Thresholds
- Tier 1: ≥5 per feature (Total: 35)
- Tier 2: ≥5 per feature (Total: 35)
- Tier 3: pairwise coverage of major feature interactions (Total: ~8)
- Tier 4: ≥5 realistic application scenarios (Total: 5)
