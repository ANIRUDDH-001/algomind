import { NextResponse, type NextRequest } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
        // Exchange the code for a session via edge-friendly cookies() store
        const supabase = await createServerSupabase();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Check if user has seen onboarding
            const hasSeenOnboarding = request.cookies.get('algomind_onboarding_complete');

            // Determine redirect based on onboarding status
            const redirectPath = hasSeenOnboarding ? '/dashboard' : '/';
            // Important: Return a fresh NextResponse.redirect *after* session setup
            return NextResponse.redirect(new URL(redirectPath, request.url));
        }
    }

    // Return to login on error
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url));
}
