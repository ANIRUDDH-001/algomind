import { useCallback, useRef, useEffect } from 'react';
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

        const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
            },
            body,
            signal: streamAbortRef.current.signal,
        });

        if (!res.ok || !res.body) {
            // Fallback: server doesn't support streaming for this endpoint
            const data = await res.json();
            return data.response ?? '';
        }

        const contentType = res.headers.get('Content-Type') ?? '';
        if (!contentType.includes('text/event-stream')) {
            // Server returned JSON despite Accept header (e.g. error path)
            const data = await res.json();
            return data.response ?? '';
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        // Add a placeholder AI message that we'll update progressively
        const streamMsgId = generateMessageId();
        currentStreamMsgIdRef.current = streamMsgId;

        const placeholderMsg: Message = {
            id: streamMsgId,
            role: 'assistant',
            content: '…',
            timestamp: new Date(),
            status: 'streaming',
        };

        if (addMessageRef.current) {
            addMessageRef.current(placeholderMsg);
        }

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n\n');
                buffer = lines.pop() ?? '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const parsed = JSON.parse(line.slice(6));

                        if (parsed.error) {
                            throw new Error(parsed.error);
                        }

                        if (parsed.done && parsed.fullText) {
                            fullText = parsed.fullText;
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
                        } else if (!parsed.done && parsed.chunk) {
                            fullText += parsed.chunk;

                            // Update the streaming message in real-time
                            if (setMessagesRef.current) {
                                setMessagesRef.current(prev => prev.map(m =>
                                    m.id === streamMsgId
                                        ? { ...m, content: fullText }
                                        : m
                                ));
                            }

                            // Real-time text appending done, defer TTS to control hook speakAndWait
                        }
                    } catch (parseErr) {
                        console.warn('[SSE] Parse error:', parseErr);
                    }
                }
            }
        } finally {
            reader.cancel();
            currentStreamMsgIdRef.current = null;
        }

        return fullText;
    }, [conversationHistoryRef]);


    const callChatApi = useCallback(async (prompt: string, systemPrompt: string, _problemContext: ProblemContext) => {
        try {
            const endpoint = optionsRef.current.apiEndpoint || '/api/chat';
            const isMainChatEndpoint = !optionsRef.current.apiEndpoint || optionsRef.current.apiEndpoint === '/api/chat';
            // Explicitly cast to any to resolve TS strictness on fetch problems with custom problems
            const currentProblemParams: any = currentProblemRef.current || {};
            const exchangeCount = Math.floor(conversationHistoryRef.current.length / 2);
            const shouldSendFullPrompt = !isMainChatEndpoint || exchangeCount <= 0;
            const turnLayer = (() => {
                const sessionStateMatch = systemPrompt.match(/<session_state>[\s\S]*?<\/session_state>/);
                const spokenLanguageLine = systemPrompt.match(/SPOKEN LANGUAGE:[^\n]+/);
                const parts = [sessionStateMatch?.[0], spokenLanguageLine?.[0]].filter(Boolean);
                return parts.length > 0 ? parts.join('\n') : undefined;
            })();
            
            const bodyStr = JSON.stringify({
                messages: [
                    ...conversationHistoryRef.current.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                    { role: 'user', content: prompt }
                ],
                systemPrompt: shouldSendFullPrompt ? systemPrompt : undefined,
                systemPromptTurnLayer: !shouldSendFullPrompt ? turnLayer : undefined,
                problemContext: {
                    title: currentProblemParams.problemTitle ?? '',
                    content: currentProblemParams.problemContent ?? '',
                    ragContext: optionsRef.current.config?.ragContext,
                    tags: currentProblemParams.tags ?? [],
                },
                // problemId and exchangeCount are required by /api/learn/chat
                // Harmless for /api/chat and /api/assess/chat (they ignore unknown fields)
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
