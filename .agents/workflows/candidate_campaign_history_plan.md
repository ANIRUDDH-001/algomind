# Implementation Plan: Candidate Campaign History 

## 1. Create `src/app/dashboard/interview-history/page.tsx`
- Setup a Server Component fetching from `candidate_submissions`.
- Fetch data: `id, campaign_id, status, overall_score, created_at, completed_at, question_states, current_problem_id`, joined with `assessment_campaigns(title, time_limit_mins)`.
- Render a table showing: Campaign Title, Status (In Progress, Completed, etc.), Score, and Date.
- Action buttons: "Resume" button pointing to `/assess/[token]` for incomplete campaigns. (Wait, the data doesn't have `entry_code` or token in this table. How to construct `/assess/[token]`? Actually, campaigns are joined via `assessment_campaigns`. Does `candidate_submissions` have a `session_token`? Let's check the schema for `candidate_submissions`).
- "View Results" button opening the report modal. Let's see how `EmployerDashboard.tsx` fetches the detailed report. Oh, the candidate themselves will also need to view the report. 

## 2. Verify Schema for Submissions
- Does `candidate_submissions` have an `assessment_session_token` or `magic_link`? Needs verification to generate the "Resume" link correctly.

## 3. Update Dashboard Navigation
- Modify `src/components/dashboard/DashboardNav.tsx` or `src/app/dashboard/page.tsx` to include an "Assessments" or "Campaigns" tab.
- When clicked, navigate to `/dashboard/interview-history`.

## Next Steps
- Review this plan to ensure it meets requirements, then proceed with schema verification and implementation.
