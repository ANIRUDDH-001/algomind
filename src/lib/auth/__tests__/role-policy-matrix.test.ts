import { describe, expect, it } from 'vitest';
import { canAccountTypePerformAction } from '@/lib/auth/role-policy';

describe('role policy matrix', () => {
    it('only admin can perform admin_api actions', () => {
        expect(canAccountTypePerformAction('admin', 'admin_api')).toBe(true);
        expect(canAccountTypePerformAction('owner', 'admin_api')).toBe(false);
        expect(canAccountTypePerformAction('employer', 'admin_api')).toBe(false);
        expect(canAccountTypePerformAction('candidate', 'admin_api')).toBe(false);
    });

    it('only owner can perform owner_api actions', () => {
        expect(canAccountTypePerformAction('owner', 'owner_api')).toBe(true);
        expect(canAccountTypePerformAction('admin', 'owner_api')).toBe(false);
        expect(canAccountTypePerformAction('employer', 'owner_api')).toBe(false);
        expect(canAccountTypePerformAction('candidate', 'owner_api')).toBe(false);
    });

    it('employer_scope allows employer, admin, and owner only', () => {
        expect(canAccountTypePerformAction('employer', 'employer_scope')).toBe(true);
        expect(canAccountTypePerformAction('admin', 'employer_scope')).toBe(true);
        expect(canAccountTypePerformAction('owner', 'employer_scope')).toBe(true);
        expect(canAccountTypePerformAction('candidate', 'employer_scope')).toBe(false);
    });
});
