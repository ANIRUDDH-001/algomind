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
