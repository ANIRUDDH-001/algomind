import { useState, useRef, useCallback } from 'react';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    status?: 'complete' | 'streaming' | 'interrupted' | 'cancelled';
    partialContent?: string;
    interruptedAt?: number;
}

export function generateMessageId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseInterviewMessagesReturn {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    conversationHistoryRef: React.MutableRefObject<Message[]>;
    addMessage: (msg: Message) => void;
    loadTranscript: (msgs: (Omit<Message, 'id'> & { id?: string })[]) => void;
    resetMessages: () => void;
    lastUserMsgRef: React.MutableRefObject<{ text: string; time: number } | null>;
}

export function useInterviewMessages(): UseInterviewMessagesReturn {
    const [messages, setMessages] = useState<Message[]>([]);
    const conversationHistoryRef = useRef<Message[]>([]);
    const lastUserMsgRef = useRef<{ text: string; time: number } | null>(null);

    const addMessage = useCallback((msg: Message) => {
        setMessages(prev => [...prev, msg]);
        conversationHistoryRef.current.push(msg);
    }, []);

    const loadTranscript = useCallback((msgs: (Omit<Message, 'id'> & { id?: string })[]) => {
        const withIds = msgs.map(m => ({
            ...m,
            id: m.id || generateMessageId(),
        })) as Message[];
        setMessages(withIds);
        conversationHistoryRef.current = withIds;
    }, []);

    const resetMessages = useCallback(() => {
        setMessages([]);
        conversationHistoryRef.current = [];
        lastUserMsgRef.current = null;
    }, []);

    return {
        messages,
        setMessages,
        conversationHistoryRef,
        addMessage,
        loadTranscript,
        resetMessages,
        lastUserMsgRef,
    };
}
