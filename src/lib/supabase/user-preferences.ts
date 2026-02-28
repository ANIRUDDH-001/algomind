import { getSupabase, isSupabaseConfigured } from './client';

const LOCAL_STORAGE_KEY = 'algomind_user_preferences';

export interface UserPreferences {
    preferredVoiceName: string | null;
    preferredVoiceLang: string;
    voiceRate: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
    preferredVoiceName: null, // null means use system default (English US)
    preferredVoiceLang: 'en-US',
    voiceRate: 1.1
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
                    .select('preferred_voice_name, preferred_voice_lang, voice_rate')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (data) {
                    return {
                        preferredVoiceName: data.preferred_voice_name,
                        preferredVoiceLang: data.preferred_voice_lang || 'en-US',
                        voiceRate: data.voice_rate || 1.1
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
