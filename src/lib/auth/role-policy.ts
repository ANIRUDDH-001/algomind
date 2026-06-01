/**
 * @codesage
 * @file      src/lib/auth/role-policy.ts
 * @purpose   Authentication guards, roles, and session management.
 * @tech      Node.js, NextAuth / Auth handlers
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        Redis / Supabase Auth
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
import type { AccountType } from '@/lib/auth/account-type';

export type RolePolicyAction = 'admin_api' | 'owner_api' | 'employer_scope';

export function canAccountTypePerformAction(accountType: AccountType, action: RolePolicyAction): boolean {
    if (action === 'admin_api') return accountType === 'admin';
    if (action === 'owner_api') return accountType === 'owner';
    if (action === 'employer_scope') {
        return accountType === 'employer' || accountType === 'admin' || accountType === 'owner';
    }
    return false;
}
