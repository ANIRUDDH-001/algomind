/**
 * Interruption analytics — lightweight localStorage-based tracking.
 *
 * Tracks how often users interrupt the AI mid-speech, how much content
 * was lost, and whether the user lets the AI finish on the next turn.
 * Useful for tuning interruption thresholds and understanding user
 * behavior patterns.
 *
 * @module interruption-analytics
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InterruptionEvent {
    /** Current interview session ID. */
    sessionId: string;
    /** When the interruption occurred. */
    timestamp: number;
    /** Characters of AI response spoken before interruption. */
    partialLength: number;
    /** Total characters of the full AI response. */
    fullLength: number;
    /** Whether the user let the AI finish its next response. */
    userLetAIFinishNext: boolean;
}

export interface InterruptionStats {
    /** Total interruptions across all sessions. */
    totalInterruptions: number;
    /** Average percentage of AI response heard before interruption. */
    avgPercentHeard: number;
    /** How often users let the AI finish on the very next turn. */
    letFinishRate: number;
    /** Interruptions per session (average). */
    interruptionsPerSession: number;
    /** Unique session count. */
    sessionCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'algomind_interruption_analytics';
const MAX_EVENTS = 200; // cap to prevent localStorage bloat

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/** Read all tracked events from localStorage. */
function readEvents(): InterruptionEvent[] {
    if (typeof localStorage === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/** Write events to localStorage. */
function writeEvents(events: InterruptionEvent[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
        // Prune to max
        const pruned = events.length > MAX_EVENTS
            ? events.slice(events.length - MAX_EVENTS)
            : events;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {
        // Quota exceeded — silently ignore
    }
}

/**
 * Track a new interruption event.
 *
 * Call this when the user interrupts AI speech.
 */
export function trackInterruption(
    sessionId: string,
    partialLength: number,
    fullLength: number,
): void {
    const events = readEvents();
    events.push({
        sessionId,
        timestamp: Date.now(),
        partialLength,
        fullLength,
        userLetAIFinishNext: false, // updated later
    });
    writeEvents(events);
}

/**
 * Mark the most recent interruption as "user let AI finish next".
 *
 * Call this when the AI completes a full response without being
 * interrupted, and the previous turn was an interruption.
 */
export function markUserLetFinish(sessionId: string): void {
    const events = readEvents();
    // Find the most recent event for this session
    for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].sessionId === sessionId && !events[i].userLetAIFinishNext) {
            events[i].userLetAIFinishNext = true;
            break;
        }
    }
    writeEvents(events);
}

/**
 * Compute aggregate statistics from tracked interruption events.
 */
export function getInterruptionStats(): InterruptionStats {
    const events = readEvents();

    if (events.length === 0) {
        return {
            totalInterruptions: 0,
            avgPercentHeard: 0,
            letFinishRate: 0,
            interruptionsPerSession: 0,
            sessionCount: 0,
        };
    }

    const sessionIds = new Set(events.map(e => e.sessionId));
    const percentages = events.map(e =>
        e.fullLength > 0 ? (e.partialLength / e.fullLength) * 100 : 0
    );
    const letFinishCount = events.filter(e => e.userLetAIFinishNext).length;

    return {
        totalInterruptions: events.length,
        avgPercentHeard: Math.round(
            percentages.reduce((a, b) => a + b, 0) / percentages.length
        ),
        letFinishRate: Math.round((letFinishCount / events.length) * 100),
        interruptionsPerSession: Math.round(
            (events.length / sessionIds.size) * 10
        ) / 10,
        sessionCount: sessionIds.size,
    };
}

/**
 * Get interruption frequency for a specific session.
 */
export function getSessionInterruptionCount(sessionId: string): number {
    return readEvents().filter(e => e.sessionId === sessionId).length;
}

/**
 * Clear all analytics data.
 */
export function clearInterruptionAnalytics(): void {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
    }
}
