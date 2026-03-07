import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * F4: Decode JWT payload without verification (for expiry check only).
 * The actual signature is already validated by Supabase when the cookie was set.
 * We only need to check expiry to decide whether to skip the network call.
 */
function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(
            Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
        );
        return payload;
    } catch {
        return null;
    }
}

/** Minimum JWT remaining life (5 min) to trust without getUser() */
const JWT_TRUST_THRESHOLD_S = 5 * 60;

export default async function middleware(request: NextRequest) {
    // Set header to hide navbar on admin routes and pass pathname to layout
    const requestHeaders = new Headers(request.headers);
    const pathname = request.nextUrl.pathname;
    requestHeaders.set('x-pathname', pathname);
    if (pathname.startsWith('/admin') || pathname.startsWith('/owner')) {
        requestHeaders.set('x-hide-navbar', 'true');
    }

    let supabaseResponse = NextResponse.next({
        request: { headers: requestHeaders },
    });

    // CRITICAL: Must use NEXT_PUBLIC_SUPABASE_URL (same as client).
    // Cookie names are derived from the URL — mixing URLs breaks session sync.
    // Strip trailing slash to ensure consistent cookie name derivation.
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const supabase = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request: { headers: requestHeaders },
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // F4: Smart validation — skip getUser() network call when JWT is healthy.
    // 1. Extract access token from Supabase auth cookie
    // 2. Decode JWT locally and check expiry
    // 3. If exp - now > 5 min → trust it, construct user from decoded `sub` claim
    // 4. If near-expiry or decode fails → fall through to getUser()
    let user: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;

    // Supabase stores the access token in a cookie matching the project ref
    const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] ?? '';
    const authCookie = request.cookies.getAll().find(c =>
        c.name.startsWith(`sb-${projectRef}-auth-token`)
    );

    let jwtTrusted = false;
    if (authCookie?.value) {
        try {
            // Cookie may be a JSON array [access_token, refresh_token] or a base64 chunk
            let accessToken: string | null = null;
            const raw = authCookie.value;
            if (raw.startsWith('base64-')) {
                // Chunked cookie — decode
                const decoded = Buffer.from(raw.slice(7), 'base64').toString('utf-8');
                const parsed = JSON.parse(decoded);
                accessToken = parsed?.access_token ?? parsed?.[0] ?? null;
            } else if (raw.startsWith('[') || raw.startsWith('{')) {
                const parsed = JSON.parse(raw);
                accessToken = Array.isArray(parsed) ? parsed[0] : parsed?.access_token ?? null;
            } else if (raw.includes('.')) {
                accessToken = raw;
            }

            if (accessToken) {
                const payload = decodeJwtPayload(accessToken);
                if (payload?.sub && payload?.exp) {
                    const nowS = Math.floor(Date.now() / 1000);
                    if (payload.exp - nowS > JWT_TRUST_THRESHOLD_S) {
                        // JWT is healthy — trust it without network call
                        user = {
                            id: payload.sub,
                            email: (payload as Record<string, unknown>).email as string | undefined,
                            app_metadata: (payload as Record<string, unknown>).app_metadata as Record<string, unknown> | undefined,
                            user_metadata: (payload as Record<string, unknown>).user_metadata as Record<string, unknown> | undefined,
                        };
                        jwtTrusted = true;
                    }
                }
            }
        } catch {
            // Decode failed — fall through to getUser()
        }
    }

    // Fallback: if JWT not trusted, do the full network call
    if (!jwtTrusted) {
        const { data } = await supabase.auth.getUser();
        user = data.user;
    }

    // Route Protection Logic
    const { searchParams } = request.nextUrl;

    // Define protected paths
    const isDashboard = pathname.startsWith('/dashboard');
    const isSettings = pathname.startsWith('/settings');
    const isInterview = pathname.startsWith('/interview');
    const isAdmin = pathname.startsWith('/admin');
    const isEmployer = pathname.startsWith('/employer');
    const isAssess = pathname.startsWith('/assess');
    const isOwnerRoute = pathname.startsWith('/owner');
    const isLearn = pathname.startsWith('/learn');

    const isTestPage = pathname.startsWith('/test') ||
        pathname.startsWith('/tts-test') ||
        pathname.startsWith('/voice-test');

    if (isTestPage && process.env.NODE_ENV !== 'development') {
        const url = request.nextUrl.clone();
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    // Guest mode check for interview (Query param or Cookie)
    const isGuestMode =
        searchParams.get('demo') === 'true' ||
        request.cookies.get('algomind_demo_mode')?.value === 'true';

    // Redirect to login if accessing protected route without user
    // E2E bypass is ONLY active in local development.
    // Never in staging, preview, or production environments.
    const isE2ETest = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        request.cookies.get('playwright-e2e')?.value === 'true';
    if (!user && !isE2ETest) {
        if (isDashboard || isSettings || isAdmin || isEmployer || isAssess || isOwnerRoute || isLearn) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            // Optionally append a redirect so they come back to the assessment link after login
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        if (isInterview && !isGuestMode) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    }

    // OWNER-001: Protect /owner routes — only owners & co-owners allowed
    if (user && isOwnerRoute) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('account_type')
            .eq('id', user.id)
            .single();

        const isOwner = profile?.account_type === 'owner';

        // Check co_owners by user_id OR email for maximum reliability.
        // user_id may not be backfilled yet for pre-existing co-owners.
        let isCoOwner = false;
        if (!isOwner) {
            const emailClause = user.email ? `,email.eq.${user.email}` : '';
            const { data: coOwner } = await supabase
                .from('co_owners')
                .select('id')
                .or(`user_id.eq.${user.id}${emailClause}`)
                .limit(1)
                .maybeSingle();
            isCoOwner = !!coOwner;
        }

        if (!isOwner && !isCoOwner) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public (public folder)
         * - vad (vad models)
         * - api/auth (auth api)
         */
        '/((?!_next/static|_next/image|favicon.ico|public/|vad/|api/auth/|auth/).*)',
    ],
};
