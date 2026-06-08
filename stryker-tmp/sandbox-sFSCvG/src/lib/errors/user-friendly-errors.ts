/**
 * @codesage
 * @file      src/lib/errors/user-friendly-errors.ts
 * @purpose   Error handling and user-friendly error formatting.
 * @tech      Node.js
 * @connects  Imports app logic, configuration, and external library utilities
 * @apis      None directly visible
 * @db        None
 * @state     Stateless
 * @env       None
 * @issues    No major issues observed.
 * @audit     CODESAGE-v1
 */
// @ts-nocheck

export interface UserFriendlyError {
    title: string;
    message: string;
    action?: string;
    actionLabel?: string;
}

export function getUserFriendlyError(error: unknown): UserFriendlyError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    // Network/Connection errors
    if (lowerMessage.includes('failed to fetch') || lowerMessage.includes('network') || lowerMessage.includes('timeout')) {
        return {
            title: 'Connection Error',
            message: 'Please check your internet connection and try again.',
            action: 'retry',
            actionLabel: 'Retry',
        };
    }

    // Rate limiting
    if (lowerMessage.includes('rate limit') || lowerMessage.includes('too many requests') || lowerMessage.includes('429')) {
        return {
            title: 'Too Many Requests',
            message: 'Please wait a moment before trying again.',
            action: 'wait',
            actionLabel: 'Wait 30s',
        };
    }

    // Authentication errors
    if (lowerMessage.includes('auth') || lowerMessage.includes('unauthorized') || lowerMessage.includes('401')) {
        return {
            title: 'Authentication Error',
            message: 'Your session has expired. Please log in again.',
            action: 'login',
            actionLabel: 'Log In',
        };
    }

    // Permission/RLS errors
    if (lowerMessage.includes('permission') || lowerMessage.includes('rls') || lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
        return {
            title: 'Permission Denied',
            message: "You don't have access to this resource.",
            action: undefined,
        };
    }

    // Supabase specific
    if (lowerMessage.includes('supabase') || lowerMessage.includes('database')) {
        return {
            title: 'Database Error',
            message: 'Failed to save your data. Please try again.',
            action: 'retry',
            actionLabel: 'Retry',
        };
    }

    // AI/Model errors
    if (lowerMessage.includes('gemini') || lowerMessage.includes('groq') || lowerMessage.includes('model')) {
        return {
            title: 'AI Service Error',
            message: 'The AI service is temporarily unavailable. Please try again.',
            action: 'retry',
            actionLabel: 'Retry',
        };
    }

    // Microphone/Audio errors
    if (lowerMessage.includes('microphone') || lowerMessage.includes('audio') || lowerMessage.includes('media')) {
        return {
            title: 'Microphone Error',
            message: 'Could not access your microphone. Please check permissions.',
            action: 'settings',
            actionLabel: 'Check Settings',
        };
    }

    // Default fallback
    return {
        title: 'Something went wrong',
        message: 'An unexpected error occurred. Please try again.',
        action: 'retry',
        actionLabel: 'Retry',
    };
}

// Helper to extract error message from various error types
export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
        return String((error as { message: unknown }).message);
    }
    return 'An unknown error occurred';
}
