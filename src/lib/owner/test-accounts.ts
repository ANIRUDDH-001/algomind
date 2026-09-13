/**
 * @codesage
 * @file      src/lib/owner/test-accounts.ts
 * @purpose   Single source of truth for identifying QA/test accounts so owner-facing
 *            metrics and aggregates exclude them (they otherwise distort prod analytics).
 * @tech      Supabase service client
 * @connects  owner overview + kg-stats aggregates
 * @db        profiles (email)
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Convention: every QA/test account is created under this email domain (see the campaign
 * harness). `profiles.account_type` cannot be used — it has a CHECK constraint that only
 * allows owner/admin/employer/candidate — so the email domain is the durable, no-DDL marker.
 */
export const TEST_ACCOUNT_EMAIL_SUFFIX = '@algomind.test';

/** PostgREST `like` pattern that matches test-account emails. */
export const TEST_ACCOUNT_EMAIL_LIKE = `%${TEST_ACCOUNT_EMAIL_SUFFIX}`;

export function isTestAccountEmail(email?: string | null): boolean {
    return !!email && email.toLowerCase().endsWith(TEST_ACCOUNT_EMAIL_SUFFIX);
}

/**
 * Resolve the ids of all test accounts. Use to exclude them from tables keyed by user_id
 * (learn_sessions, concept_states, interview_sessions, ...) which carry no email.
 * Returns [] on error so callers degrade to "no exclusion" rather than failing.
 */
export async function getTestAccountIds(svc: SupabaseClient): Promise<string[]> {
    try {
        const { data, error } = await svc
            .from('profiles')
            .select('id')
            .like('email', TEST_ACCOUNT_EMAIL_LIKE);
        if (error || !data) return [];
        return data.map((r) => r.id as string);
    } catch {
        // Never let a metrics-exclusion lookup break the page — degrade to "no exclusion".
        return [];
    }
}

/**
 * Build the value for a PostgREST `.not('user_id', 'in', ...)` filter.
 * Returns null when there is nothing to exclude so callers can skip the filter.
 */
export function notInIdList(ids: string[]): string | null {
    if (ids.length === 0) return null;
    return `(${ids.map((id) => `"${id}"`).join(',')})`;
}
