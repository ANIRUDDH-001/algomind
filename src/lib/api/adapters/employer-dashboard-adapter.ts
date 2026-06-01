/**
 * @codesage
 * @file      src/lib/api/adapters/employer-dashboard-adapter.ts
 * @purpose   API adapter for employer dashboard actions like viewing submissions and managing campaigns
 * @tech      fetch
 * @connects  imports requestBlob, requestJson from '@/lib/api/client'
 * @apis      GET /api/employer/submissions/{campaignId}, GET /api/employer/submissions/{campaignId}/report/{submissionId}, DELETE /api/employer/campaigns/{id}, GET /api/employer/submissions/{campaignId}/export
 * @db        None
 * @state     None
 * @env       None
 * @issues    None
 * @audit     CODESAGE-v1
 */
import { requestBlob, requestJson } from '@/lib/api/client';

interface CandidateSubmissionSummary {
  total: number;
  completed: number;
  in_progress: number;
  dropped_out: number;
  invited: number;
  expired: number;
}

interface CandidateSubmissionResponse<TSubmission> {
  submissions: TSubmission[];
  summary: CandidateSubmissionSummary | null;
}

interface CampaignActionResponse {
  success: boolean;
  action?: string;
}

export const EmployerDashboardAdapter = {
  getSubmissions<TSubmission>(campaignId: string, statusFilter: string): Promise<CandidateSubmissionResponse<TSubmission>> {
    const query = statusFilter !== 'all' ? { status: statusFilter } : undefined;
    return requestJson<CandidateSubmissionResponse<TSubmission>>(`/api/employer/submissions/${campaignId}`, undefined, query);
  },

  getSubmissionReport<TReport>(campaignId: string, submissionId: string): Promise<TReport> {
    return requestJson<TReport>(`/api/employer/submissions/${campaignId}/report/${submissionId}`);
  },

  campaignDeactivate(id: string): Promise<CampaignActionResponse> {
    return requestJson<CampaignActionResponse>(`/api/employer/campaigns/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'deactivate' }),
    });
  },

  campaignDelete(id: string): Promise<CampaignActionResponse> {
    return requestJson<CampaignActionResponse>(`/api/employer/campaigns/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete' }),
    });
  },

  exportSubmissions(campaignId: string): Promise<{ blob: Blob; response: Response }> {
    return requestBlob(`/api/employer/submissions/${campaignId}/export`);
  },
};
