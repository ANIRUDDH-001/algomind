import { useCallback } from 'react';
import type { Message, ProblemContext, UseInterviewOptions } from './useInterview';
import type { InterviewStateMachine } from '@/lib/interview/state-machine';

export interface UseInterviewApiOptions {
    conversationHistoryRef: React.MutableRefObject<Message[]>;
    currentProblemRef: React.MutableRefObject<ProblemContext | null>;
    stateMachineRef: React.MutableRefObject<InterviewStateMachine>;
    optionsRef: React.MutableRefObject<UseInterviewOptions>;
}

export interface UseInterviewApiReturn {
    callChatApi: (prompt: string, systemPrompt: string, ctx: ProblemContext) => Promise<string>;
    fetchWithRetry: (url: string, options: RequestInit, retries?: number, backoff?: number) => Promise<any>;
}

export function useInterviewApi({
    conversationHistoryRef,
    currentProblemRef,
    stateMachineRef,
    optionsRef,
}: UseInterviewApiOptions): UseInterviewApiReturn {
    
    const fetchWithRetry = useCallback(async (url: string, fetchOptions: RequestInit, retries = 3, backoff = 1000): Promise<any> => {
        const runFetch = async (currentRetries: number, currentBackoff: number): Promise<any> => {
            try {
                const response = await fetch(url, fetchOptions);

                if (response.status === 429 || response.status >= 500) {
                    if (currentRetries > 0) {
                        console.log(`[Retry] Request failed with ${response.status}. Retrying in ${currentBackoff}ms...`);
                        await new Promise(resolve => setTimeout(resolve, currentBackoff));
                        return runFetch(currentRetries - 1, currentBackoff * 2);
                    }
                }

                if (!response.ok) {
                    const err = (await response.json().catch(() => ({ error: 'Failed to fetch chat response' }))) as { error?: string };
                    throw new Error(err.error || `Request failed with status ${response.status}`);
                }

                return await response.json();
            } catch (error) {
                if (currentRetries > 0) {
                    console.log(`[Retry] Network error. Retrying in ${currentBackoff}ms...`, error);
                    await new Promise(resolve => setTimeout(resolve, currentBackoff));
                    return runFetch(currentRetries - 1, currentBackoff * 2);
                }
                throw error;
            }
        };

        return runFetch(retries, backoff);
    }, []);

    const callChatApi = useCallback(async (prompt: string, systemPrompt: string, _problemContext: ProblemContext) => {
        try {
            const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
            // Explicitly cast to any to resolve TS strictness on fetch problems with custom problems
            const currentProblemParams: any = currentProblemRef.current || {};
            
            const data = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [
                        ...conversationHistoryRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                        { role: 'user', content: prompt }
                    ],
                    systemPrompt,
                    problemContext: {
                        title: currentProblemParams.title ?? '',
                        content: currentProblemParams.content ?? '',
                        ragContext: optionsRef.current.config?.ragContext,
                        tags: currentProblemParams.tags ?? [],
                    },
                    sessionToken: optionsRef.current.sessionToken,
                    guestMode: optionsRef.current.isGuest ?? false,
                    interviewState: stateMachineRef.current.getState(),
                })
            });

            return data.response;
        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    }, [fetchWithRetry, conversationHistoryRef, currentProblemRef, optionsRef, stateMachineRef]);

    return {
        fetchWithRetry,
        callChatApi,
    };
}
