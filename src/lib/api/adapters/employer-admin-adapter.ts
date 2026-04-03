import { requestJson, requestVoid } from '@/lib/api/client';

export interface EmployerInviteDto {
  id: string;
  invite_code: string;
  email: string | null;
  company_name: string;
  expires_at: string | null;
  is_active: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export interface EmployerProfileDto {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
}

export interface OwnerUserSearchResultDto {
  id: string;
  email: string;
  full_name?: string | null;
}

interface EmployerInvitesResponse {
  invites: EmployerInviteDto[];
}

interface EmployersResponse {
  employers: EmployerProfileDto[];
}

interface OwnerUsersResponse {
  users: OwnerUserSearchResultDto[];
}

interface OwnerStatusResponse {
  isOwner: boolean;
}

interface SuccessResponse {
  success: boolean;
}

export const EmployerAdminAdapter = {
  getOwnerStatus(): Promise<OwnerStatusResponse> {
    return requestJson<OwnerStatusResponse>('/api/user/owner-status');
  },

  getInvites(): Promise<EmployerInvitesResponse> {
    return requestJson<EmployerInvitesResponse>('/api/admin/employer-invites');
  },

  getEmployers(): Promise<EmployersResponse> {
    return requestJson<EmployersResponse>('/api/admin/employers');
  },

  createInvite(payload: { companyName: string; email: string | null; expiresAt: string | null }): Promise<{ invite: EmployerInviteDto }> {
    return requestJson<{ invite: EmployerInviteDto }>('/api/admin/employer-invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  deactivateInvite(id: string): Promise<SuccessResponse> {
    return requestJson<SuccessResponse>('/api/admin/employer-invites', { method: 'DELETE' }, { id });
  },

  searchOwnerUsers(query: string): Promise<OwnerUsersResponse> {
    return requestJson<OwnerUsersResponse>('/api/owner/users', undefined, { q: query });
  },

  updateOwnerUser(payload: { userId: string; accountType: 'candidate' | 'employer' }): Promise<void> {
    return requestVoid('/api/owner/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};
