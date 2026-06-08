# Dead Code & Code Quality Log

## Findings from SEC-08A

- **Console statements:** Several files (e.g., `auth/callback/route.ts`, `interview/error.tsx`, `dashboard/error.tsx`) contain left-over `console.error` and `console.log` statements that should ideally be routed through the `reportError` telemetry system exclusively or removed for production builds.
- **Redundant Loading States:** Some nested loading components (`dashboard/loading.tsx`, `employer/dashboard/loading.tsx`) replicate large skeleton structures that could be abstracted into a common `SkeletonLayout` component to reduce duplicated code.
- **Stale Cache Keys:** In `interview/page.tsx`, there's a hardcoded one-time eviction for a stale cache key (`react-resizable-panels:interview_panels_v2`). This block of logic is dead weight for users who have never visited the old version and could be removed in future updates once all users have migrated.
- **Unused imports / Variables:** In test files (like `__tests__/analysis.test.tsx`), certain mocked modules or variables (like the `usePathname` mock) are defined but minimally or never used within the tests.
- **Deprecated Props:** The `<CandidateInterview>` component is receiving `campaign` props that might have unused fields fetched from the database (e.g., `default_easy_mins`, etc. which are queried in `assess/[token]/page.tsx` but not used in the page itself).

## Recommendations
- Create a shared `LoadingSkeleton` component.
- Implement ESLint rules to strip `console.*` from production builds automatically (if not already handled by Next.js configuration).
- Remove migration code for old local storage keys after a set period.

## Findings from SEC-11 (Types & Contexts)

- No dead code or unused imports were identified in `src/types/*`. Type declaration files are generally clean and strictly define application structures and interfaces.
- The `supabase.ts` file is a massive, auto-generated schema definition (2300+ lines). No manual dead-code stripping was performed here as it should be managed by the Supabase CLI.

## Findings from SEC-10A

- **src/components/dashboard/SkillTrendCard.tsx**: Removed unused 'LineChart' and 'Line' imports from 'recharts' and the corresponding eslint-disable comment.
- **src/components/charts/SkillDrillDown.tsx**: Removed unused 'XAxis' import from 'recharts'.
- **src/components/dashboard/ExportReportButton.tsx**: Removed unused 'useRef' import from 'react' and 'buttonRef' variable declaration.
- **src/components/dashboard/__tests__/PDFReport.test.tsx**: Removed unused import 'within' from '@testing-library/react' and 'beforeEach' from 'vitest'.
- **src/components/auth/AuthProvider.tsx**: Removed unused data variables and console.logs in `signInWithPassword` and `signUp` methods.
- **src/components/analysis/AnalysisClient.tsx (UNCERTAIN)**: At the bottom of the AnalysisClient CTA section, there is a duplicate link for returning to the dashboard. One says 'Back to Dashboard' and the other says 'Go to Dashboard'.
- **src/components/analysis/__tests__/SkillBar.expanded.test.tsx (UNCERTAIN)**: The imports `fireEvent` and `waitFor` from `@testing-library/react` are unused. This was flagged in the `@issues` annotation rather than removed.
