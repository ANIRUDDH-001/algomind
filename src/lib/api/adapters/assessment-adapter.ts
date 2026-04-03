import { requestJson, requestVoid } from '@/lib/api/client';

export interface VerifyCodeRequest {
  publicToken: string;
  entryCode: string;
  candidateName: string;
  candidateEmail: string;
}

export interface VerifyCodeResponse {
  valid: boolean;
  reason?: string;
  questions?: unknown[];
  campaign?: {
    time_limit_mins?: number;
  };
}

export interface StartAssessmentRequest {
  campaignToken: string;
  candidateName: string;
  candidateEmail?: string;
  entryCode: string;
}

export interface StartAssessmentResponse {
  sessionToken: string;
  startedAt: string;
  submissionId: string;
  questionStates: unknown[];
  questions: unknown[];
  showScoreToCandidate: boolean;
}

export interface CompleteAssessmentRequest {
  sessionToken: string;
  questionStates: unknown[];
  totalDuration: number;
}

export interface CompleteAssessmentResponse {
  overallScore?: number;
}

export interface SaveProgressRequest {
  sessionToken: string;
  questionStates: unknown[];
  currentProblemId: string | null;
}

export interface CreateCampaignRequest {
  title: string;
  campaignQuestions: Array<{ problem_id: string; time_limit_mins: number }>;
  defaultEasyMins: number;
  defaultMediumMins: number;
  defaultHardMins: number;
  maxUses?: number;
  expiresAt: string;
  showScoreToCandidate: boolean;
}

export interface CreateCampaignResponse<TCampaign = unknown> {
  campaign: TCampaign;
}

export const AssessmentAdapter = {
  verifyCode(payload: VerifyCodeRequest): Promise<VerifyCodeResponse> {
    return requestJson<VerifyCodeResponse>('/api/assess/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  start(payload: StartAssessmentRequest): Promise<StartAssessmentResponse> {
    return requestJson<StartAssessmentResponse>('/api/assess/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  complete(payload: CompleteAssessmentRequest): Promise<CompleteAssessmentResponse> {
    return requestJson<CompleteAssessmentResponse>('/api/assess/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  saveProgress(payload: SaveProgressRequest): Promise<void> {
    return requestVoid('/api/assess/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  createCampaign<TCampaign = unknown>(payload: CreateCampaignRequest): Promise<CreateCampaignResponse<TCampaign>> {
    return requestJson<CreateCampaignResponse<TCampaign>>('/api/employer/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};