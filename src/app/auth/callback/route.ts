import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next') ?? '/dashboard';
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(searchParams.get('error_description') || error)}`
        );
    }

    const supabase = await createServerSupabase();

    // PKCE code exchange (OAuth + magic link new flow)
    if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            console.error('[auth/callback] Code exchange failed:', exchangeError.message);
            return NextResponse.redirect(
                `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
            );
        }
        return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/dashboard'}`);
    }

    // Token hash — magic link legacy flow
    if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as 'email' | 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change',
        });
        if (verifyError) {
            return NextResponse.redirect(
                `${origin}/login?error=${encodeURIComponent(verifyError.message)}`
            );
        }
        return NextResponse.redirect(`${origin}/dashboard`);
    }

    return NextResponse.redirect(`${origin}/login?error=invalid_callback`);
}
