/**
 * @codesage
 * @file      src/components/enterprise/__tests__/CampaignInterviewSession.runtime.test.tsx
 * @purpose   Runtime flow tests for CampaignInterviewSession.
 * @tech      Vitest, React Testing Library
 * @connects  ../CampaignInterviewSession
 * @apis      None
 * @db        None
 * @state     None
 * @env       None
 * @issues    None observed
 * @audit     CODESAGE-v1
 * @skip      test-file
 */
/**
 * @vitest-environment jsdom
 */
// @ts-expect-error -- automated unused local suppression
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CampaignInterviewSession } from '../CampaignInterviewSession';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/lib/utils/device-detection', () => ({
  isMobileDevice: () => false,
}));

vi.mock('@/components/interview/InterviewSession', () => ({
  InterviewSession: ({ onAssessmentComplete }: { onAssessmentComplete: (elapsed: number, transcript: any[]) => Promise<void> }) => (
    <div>
      <div data-testid="mock-interview-session">Interview Runtime</div>
      <button
        onClick={async () => {
          await onAssessmentComplete(90, [
            { speaker: 'user', text: 'my answer' },
            { speaker: 'assistant', text: 'feedback' },
          ]);
        }}
      >
        Complete Question
      </button>
    </div>
  ),
}));

describe('CampaignInterviewSession runtime flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({}) }));
    vi.stubGlobal('navigator', {
      ...(globalThis.navigator || {}),
      sendBeacon: vi.fn().mockReturnValue(true),
    } as Navigator);
  });

  it('selects a question, renders interview runtime, and marks question complete', async () => {
    const onComplete = vi.fn().mockResolvedValue(undefined);
    const questions = [
      {
        id: 'q1',
        title: 'Two Sum',
        description: 'Find pair sum',
        difficulty: 'easy',
        time_limit_mins: 10,
        order: 0,
      },
    ];

    const initialStates = [
      {
        problem_id: 'q1',
        order: 0,
        time_limit_mins: 10,
        status: 'not_started' as const,
        started_at: null,
        completed_at: null,
        elapsed_secs: 0,
        transcript: [],
      },
    ];

    render(
      <CampaignInterviewSession
        sessionToken="token"
        submissionId="sub1"
        questions={questions as any}
        initialQuestionStates={initialStates}
        startedAt={new Date().toISOString()}
        showScoreToCandidate={true}
        onComplete={onComplete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    await waitFor(() => {
      expect(screen.getByTestId('mock-interview-session')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /complete question/i }));

    await waitFor(() => {
      expect(screen.getByText(/completed/i)).toBeTruthy();
    });
  });
});
