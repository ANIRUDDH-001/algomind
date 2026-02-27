// src/app/auth/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/dashboard';
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth errors
    if (error) {
        console.error('[auth/callback] OAuth error:', error, errorDescription);
        return NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
        );
    }

    if (code) {
        const supabase = await createServerSupabase();
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
            console.error('[auth/callback] Code exchange failed:', exchangeError.message);
            return NextResponse.redirect(
                `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
            );
        }

        // Successful auth — redirect to intended destination
        const redirectTo = next.startsWith('/') ? next : '/dashboard';
        return NextResponse.redirect(`${origin}${redirectTo}`);
    }

    // No code — shouldn't happen, redirect to login
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
