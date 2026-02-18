/**
 * Analytics tracking for voice features
 */

interface VoiceEvent {
    type: 'vad_init' | 'vad_error' | 'interruption' | 'smart_routing' | 'cache_hit' | 'cache_miss' | 'interview_start' | 'interview_complete';
    timestamp: number;
    metadata?: Record<string, any>;
}

class VoiceAnalytics {
    private events: VoiceEvent[] = [];

    track(type: VoiceEvent['type'], metadata?: Record<string, any>) {
        const event: VoiceEvent = {
            type,
            timestamp: Date.now(),
            metadata,
        };

        this.events.push(event);

        // Send to analytics service (e.g., PostHog, Mixpanel, GA4)
        // In a real implementation, this would be: 
        // analytics.track(`voice_${type}`, { ...metadata, timestamp: event.timestamp });

        if (typeof window !== 'undefined' && (window as any).analytics) {
            try {
                (window as any).analytics.track(`voice_${type}`, metadata);
            } catch (e) {
                // Ignore analytics errors
            }
        }

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[Voice Analytics] ${type}`, metadata);
        }
    }

    getStats() {
        const now = Date.now();
        const last24h = this.events.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);

        const cacheHits = last24h.filter(e => e.type === 'cache_hit').length;
        const cacheMisses = last24h.filter(e => e.type === 'cache_miss').length;
        const cacheTotal = cacheHits + cacheMisses;

        return {
            totalEvents: last24h.length,
            byType: last24h.reduce((acc, e) => {
                acc[e.type] = (acc[e.type] || 0) + 1;
                return acc;
            }, {} as Record<string, number>),
            interruptionRate: last24h.length > 0
                ? last24h.filter(e => e.type === 'interruption').length / last24h.length
                : 0,
            cacheHitRate: cacheTotal > 0 ? cacheHits / cacheTotal : 0,
        };
    }
}

export const voiceAnalytics = new VoiceAnalytics();
