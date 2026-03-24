import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next') ?? '/';
    const error = searchParams.get('error');

    if (error) {
        return NextResponse.redirect(
            `${origin}/login?error=${encodeURIComponent(searchParams.get('error_description') || error)}`
        );
    }

    const cookieStore = await cookies();
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');

    // Create a redirect response first so we can attach cookies to it
    const redirectTo = next.startsWith('/') ? `${origin}${next}` : `${origin}/`;
    const response = NextResponse.redirect(redirectTo);

    const supabase = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    // Write cookies BOTH to the cookie store AND to the response headers
                    cookiesToSet.forEach(({ name, value, options }) => {
                        try { cookieStore.set(name, value, options); } catch { /* server component */ }
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    // PKCE code exchange (OAuth + magic link new flow)
    if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
            console.error('[auth/callback] Code exchange failed:', exchangeError.message);
            return NextResponse.redirect(
                `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
            );
        }
        return response; // ← return response with cookies attached, not a fresh redirect
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
        return response; // ← return response with cookies attached
    }

    return NextResponse.redirect(`${origin}/login?error=invalid_callback`);
}
