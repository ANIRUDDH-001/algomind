/**
 * @codesage
 * @file      src/hooks/useInterviewApi.ts
 * @purpose   React hook handling backend API communication for the interview chat, including SSE and Supabase Realtime fallback.
 * @tech      React, Fetch API, Supabase Realtime
 * @connects  Used by useInterviewControl / Interview Session components
 * @apis      POST /api/chat (and other dynamic endpoints)
 * @db        Supabase Realtime: interview_<sessionId>
 * @state     Refs for stream cancellation and current stream message ID
 * @env       none
 * @issues    none
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

// 

import { useCallback, useRef, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import type { Message, ProblemContext, UseInterviewOptions } from './useInterview';
import type { InterviewStateMachine } from '@/lib/interview/state-machine';
import { generateMessageId } from './useInterviewMessages';

export interface UseInterviewApiOptions {
    conversationHistoryRef: React.MutableRefObject<Message[]>;
    currentProblemRef: React.MutableRefObject<ProblemContext | null>;
    stateMachineRef: React.MutableRefObject<InterviewStateMachine>;
    optionsRef: React.MutableRefObject<UseInterviewOptions>;
}

export interface UseInterviewApiReturn {
    callChatApi: (prompt: string, systemPrompt: string, ctx: ProblemContext) => Promise<string>;
    callChatApiStreaming: (endpoint: string, body: string) => Promise<string>;
    fetchWithRetry: (url: string, options: RequestInit, retries?: number, backoff?: number) => Promise<any>;
    /** Ref to the message ID currently being streamed (null if not streaming) */
    currentStreamMsgIdRef: React.MutableRefObject<string | null>;
}

// Re-export for control hook access
export type { Message };

export function useInterviewApi({
    conversationHistoryRef,
    currentProblemRef,
    stateMachineRef,
    optionsRef,
}: UseInterviewApiOptions): UseInterviewApiReturn {
    
    const currentStreamMsgIdRef = useRef<string | null>(null);
    const streamAbortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => { streamAbortRef.current?.abort(); };
    }, []);

    /** setMessages accessor — pulled from the messages hook via the control hook's setMessages.
     *  We store a ref that the control hook can wire up. */
    const setMessagesRef = useRef<React.Dispatch<React.SetStateAction<Message[]>> | null>(null);
    const addMessageRef = useRef<((msg: Message) => void) | null>(null);

    // These will be wired by useInterviewControl after construction
    // For now they're used inside callChatApiStreaming closure
    const ttsRef = useRef<{ speak: (text: string) => void; isSpeaking: boolean } | null>(null);

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

    const callChatApiStreaming = useCallback(async (
        endpoint: string,
        body: string
    ): Promise<string> => {
        if (streamAbortRef.current) streamAbortRef.current.abort();
        streamAbortRef.current = new AbortController();

        const parsedBody = JSON.parse(body);
        const sessionId = parsedBody.sessionId || 'default-session';
        const supabase = getSupabase();

        // Add a placeholder AI message that we'll update progressively
        const streamMsgId = generateMessageId();
        currentStreamMsgIdRef.current = streamMsgId;

        const placeholderMsg: Message = {
            id: streamMsgId,
            role: 'assistant',
            content: '...',
            timestamp: new Date(),
            status: 'streaming',
        };

        if (addMessageRef.current) {
            addMessageRef.current(placeholderMsg);
        }

        return new Promise<string>((resolve, reject) => {
            let fullText = '';
            let isResolved = false;

            if (!supabase) {
                reject(new Error("Supabase client not initialized"));
                return;
            }

            // 1. Subscribe to the Supabase channel for this session
            const channel = supabase.channel(`interview_${sessionId}`);

            channel.on('broadcast', { event: 'chat_chunk' }, (payload) => {
                if (payload.payload.error) {
                    supabase.removeChannel(channel);
                    reject(new Error(payload.payload.error));
                    return;
                }

                if (payload.payload.delta) {
                    fullText += payload.payload.delta;

                    // Update the streaming message in real-time
                    if (setMessagesRef.current) {
                        setMessagesRef.current(prev => prev.map(m =>
                            m.id === streamMsgId
                                ? { ...m, content: fullText }
                                : m
                        ));
                    }
                }
            });

            channel.on('broadcast', { event: 'chat_done' }, (payload) => {
                // Ensure we get the final text if passed, or fallback to accumulated
                if (payload.payload.fullText) {
                    fullText = payload.payload.fullText;
                }

                // Update the streaming message to complete
                if (setMessagesRef.current) {
                    setMessagesRef.current(prev => prev.map(m =>
                        m.id === streamMsgId
                            ? { ...m, content: fullText, status: 'complete' as const }
                            : m
                    ));
                }
                
                // Also update conversationHistoryRef
                const histIdx = conversationHistoryRef.current.findLastIndex(m => m.id === streamMsgId);
                if (histIdx >= 0) {
                    conversationHistoryRef.current[histIdx] = {
                        ...conversationHistoryRef.current[histIdx],
                        content: fullText,
                        status: 'complete',
                    };
                }

                currentStreamMsgIdRef.current = null;
                supabase.removeChannel(channel);
                if (!isResolved) {
                    isResolved = true;
                    resolve(fullText);
                }
            });

            // 2. Wait for subscription to be established
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    try {
                        // 3. Dispatch the API request to trigger the Inngest job
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'text/event-stream', // Signals the backend to use Inngest
                            },
                            body,
                            signal: streamAbortRef.current?.signal,
                        });

                        if (!res.ok) {
                            throw new Error(`API error: ${res.status}`);
                        }
                    } catch (error) {
                        supabase.removeChannel(channel);
                        currentStreamMsgIdRef.current = null;
                        if (!isResolved) {
                            isResolved = true;
                            reject(error);
                        }
                    }
                }
            });
        });
    }, [conversationHistoryRef]);


    const callChatApi = useCallback(async (prompt: string, _systemPrompt: string, _problemContext: ProblemContext) => {
        try {
            const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
            const isMainChatEndpoint = !optionsRef.current.apiEndpoint || optionsRef.current.apiEndpoint === '/api/chat';
            // Explicitly cast to any to resolve TS strictness on fetch problems with custom problems
            const currentProblemParams: any = currentProblemRef.current || {};
            const exchangeCount = Math.floor(conversationHistoryRef.current.length / 2);

            const bodyStr = JSON.stringify({
                messages: [
                    ...conversationHistoryRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: prompt }
                ],
                problemContext: {
                    title: currentProblemParams.problemTitle ?? '',
                    content: currentProblemParams.problemContent ?? '',
                    ragContext: optionsRef.current.config?.ragContext,
                    tags: currentProblemParams.tags ?? [],
                },
                // problemId and exchangeCount are used by learn/assess pipelines when present.
                // Harmless for /api/chat and /api/assess/chat (they ignore unknown fields).
                problemId: currentProblemParams.problemId ?? null,
                exchangeCount,
                sessionToken: optionsRef.current.sessionToken,
                sessionId: optionsRef.current.sessionToken ?? currentProblemParams.problemId ?? 'default-session',
                guestMode: optionsRef.current.isGuest ?? false,
                interviewState: stateMachineRef.current.getState(),
            });

            // Only use streaming for the main chat endpoint (not learn, not assess)
            if (isMainChatEndpoint) {
                return await callChatApiStreaming(endpoint, bodyStr);
            }

            // Non-streaming fallback for learn/assess endpoints
            const data = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyStr,
            });
            return data.response;

        } catch (error) {
            console.error('API Call Failed:', error);
            throw error;
        }
    }, [fetchWithRetry, callChatApiStreaming, conversationHistoryRef, currentProblemRef, optionsRef, stateMachineRef]);

    // Expose refs for wiring by useInterviewControl
    const apiReturn: UseInterviewApiReturn & {
        _setMessagesRef: typeof setMessagesRef;
        _addMessageRef: typeof addMessageRef;
        _ttsRef: typeof ttsRef;
    } = {
        fetchWithRetry,
        callChatApi,
        callChatApiStreaming,
        currentStreamMsgIdRef,
        _setMessagesRef: setMessagesRef,
        _addMessageRef: addMessageRef,
        _ttsRef: ttsRef,
    };

    return apiReturn;
}
