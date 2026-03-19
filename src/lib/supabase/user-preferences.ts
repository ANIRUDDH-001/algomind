import { getSupabase, isSupabaseConfigured } from './client';

const LOCAL_STORAGE_KEY = 'algomind_user_preferences';

export interface UserPreferences {
    preferredVoiceName: string | null;
    preferredVoiceLang: string;
    voiceRate: number;
    hinglishEnabled: boolean;
    ttsProvider: 'auto' | 'polly' | 'browser';
}

const DEFAULT_PREFERENCES: UserPreferences = {
    preferredVoiceName: null, // null means use system default (English US)
    preferredVoiceLang: 'en-US',
    voiceRate: 1.1,
    hinglishEnabled: false,
    ttsProvider: 'auto'
};

/**
 * Get user preferences from Supabase or localStorage
 */
export async function getUserPreferences(userId: string | null): Promise<UserPreferences> {
    // Try Supabase first if authenticated
    if (userId && userId !== 'guest-user') {
        const supabase = getSupabase();

        if (supabase && isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('user_preferences')
                    .select('preferred_voice_name, preferred_voice_lang, voice_rate, hinglish_enabled, tts_provider')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (data) {
                    return {
                        preferredVoiceName: data.preferred_voice_name,
                        preferredVoiceLang: data.preferred_voice_lang || 'en-US',
                        voiceRate: data.voice_rate || 1.1,
                        hinglishEnabled: data.hinglish_enabled ?? false,
                        ttsProvider: (data.tts_provider as 'auto' | 'polly' | 'browser') ?? 'auto'
                    };
                }
            } catch (error) {
                console.warn('Failed to load user preferences from DB:', error);
            }
        }
    }

    // Fallback to localStorage
    return getLocalPreferences();
}

/**
 * Save user preferences to Supabase or localStorage
 */
export async function saveUserPreferences(
    userId: string | null,
    prefs: Partial<UserPreferences>
): Promise<void> {
    // Save to Supabase if authenticated
    if (userId && userId !== 'guest-user') {
        const supabase = getSupabase();

        if (supabase && isSupabaseConfigured()) {
            try {
                const { error } = await supabase
                    .from('user_preferences')
                    .upsert({
                        user_id: userId,
                        preferred_voice_name: prefs.preferredVoiceName,
                        preferred_voice_lang: prefs.preferredVoiceLang,
                        voice_rate: prefs.voiceRate,
                        hinglish_enabled: prefs.hinglishEnabled,
                        tts_provider: prefs.ttsProvider,
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'user_id'
                    });

                if (error) {
                    console.warn('Failed to save preferences to DB:', error);
                }
            } catch (error) {
                console.warn('Failed to save user preferences:', error);
            }
        }
    }

    // Always save to localStorage as backup
    saveLocalPreferences(prefs);
}

/**
 * Get preferences from localStorage
 */
function getLocalPreferences(): UserPreferences {
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_PREFERENCES, ...parsed };
        }
    } catch {
        // Ignore parse errors
    }
    return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
function saveLocalPreferences(prefs: Partial<UserPreferences>): void {
    try {
        const current = getLocalPreferences();
        const updated = { ...current, ...prefs };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Get user subscription status from profiles table.
 * Used by freemium gate (Phase 2F).
 */
export async function getUserSubscriptionStatus(
    userId: string
): Promise<{ status: 'free' | 'premium' | 'college'; expiresAt: string | null }> {
    try {
        const { getServiceClient } = await import('./service');
        const { data, error } = await getServiceClient()
            .from('profiles')
            .select('subscription_status, subscription_expires_at')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return { status: 'free', expiresAt: null };
        }

        // Auto-downgrade expired subscriptions without blocking callers.
        if (
            data.subscription_status !== 'free' &&
            data.subscription_expires_at &&
            new Date(data.subscription_expires_at) < new Date()
        ) {
            void getServiceClient()
                .from('profiles')
                .update({ subscription_status: 'free', subscription_expires_at: null })
                .eq('id', userId);

            return { status: 'free', expiresAt: null };
        }

        return {
            status: data.subscription_status as 'free' | 'premium' | 'college',
            expiresAt: data.subscription_expires_at,
        };
    } catch {
        return { status: 'free', expiresAt: null };
    }
}
