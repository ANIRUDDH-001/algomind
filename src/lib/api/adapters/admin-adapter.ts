/**
 * @codesage
 * @file      src/lib/api/adapters/admin-adapter.ts
 * @purpose   API adapter for managing admin users and checking owner status
 * @tech      fetch
 * @connects  imports requestJson, requestVoid from '@/lib/api/client'
 * @apis      GET /api/admin/admins, GET /api/user/owner-status, POST /api/admin/admins, DELETE /api/admin/admins
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { requestJson, requestVoid } from '@/lib/api/client';

export interface AdminUserDto {
  id: string;
  email: string;
  added_at: string;
}

interface OwnerStatusDto {
  isOwner: boolean;
}

interface SuccessDto {
  success: boolean;
}

export const AdminAdapter = {
  getAdmins(): Promise<AdminUserDto[]> {
    return requestJson<AdminUserDto[]>('/api/admin/admins');
  },

  getOwnerStatus(): Promise<OwnerStatusDto> {
    return requestJson<OwnerStatusDto>('/api/user/owner-status');
  },

  addAdmin(email: string): Promise<SuccessDto> {
    return requestJson<SuccessDto>('/api/admin/admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  },

  removeAdmin(email: string): Promise<void> {
    return requestVoid('/api/admin/admins', { method: 'DELETE' }, { email });
  },
};
