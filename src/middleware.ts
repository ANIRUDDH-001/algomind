import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const DIAGNOSTIC_COMPLETE_COOKIE = 'diag_done';

export default async function middleware(request: NextRequest) {
    const correlationId = request.headers.get('x-correlation-id') ?? crypto.randomUUID();
    let shouldSetDiagnosticCookie = false;
    const withCorrelationId = (response: NextResponse) => {
        response.headers.set('x-correlation-id', correlationId);
        return response;
    };
    const clearDiagnosticCookie = (response: NextResponse) => {
        response.cookies.delete(DIAGNOSTIC_COMPLETE_COOKIE);
        return response;
    };

    // Set header to hide navbar on admin routes and pass pathname to layout
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-correlation-id', correlationId);
    const pathname = request.nextUrl.pathname;
    requestHeaders.set('x-pathname', pathname);
    if (pathname.startsWith('/admin') || pathname.startsWith('/owner')) {
        requestHeaders.set('x-hide-navbar', 'true');
    }

    let supabaseResponse = NextResponse.next({
        request: { headers: requestHeaders },
    });
    supabaseResponse.headers.set('x-correlation-id', correlationId);

    // CRITICAL: Must use NEXT_PUBLIC_SUPABASE_URL (same as client).
    // Cookie names are derived from the URL — mixing URLs breaks session sync.
    // Strip trailing slash to ensure consistent cookie name derivation.
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
    const canUseSupabase = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

    let supabase: ReturnType<typeof createServerClient> | null = null;
    let user: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;

    if (canUseSupabase) {
        supabase = createServerClient(
            supabaseUrl,
            supabaseAnonKey,
            {
                cookies: {
                    getAll() {
                        return request.cookies.getAll();
                    },
                    setAll(cookiesToSet) {
                        try {
                            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                        } catch (error) {
                            console.warn('[middleware] Failed to mirror auth cookies into request store:', error);
                        }
                        supabaseResponse = NextResponse.next({
                            request: { headers: requestHeaders },
                        });
                        supabaseResponse.headers.set('x-correlation-id', correlationId);
                        try {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                supabaseResponse.cookies.set(name, value, options)
                            );
                        } catch (error) {
                            console.warn('[middleware] Failed to persist auth cookies on response:', error);
                        }
                    },
                },
            }
        );

        const { data } = await supabase.auth.getUser();
        user = data.user;
    } else if (process.env.NODE_ENV !== 'production') {
        console.warn('[middleware] Missing NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY. Continuing without Supabase auth sync.');
    }

    // Route Protection Logic
    const { searchParams } = request.nextUrl;

    // Define protected paths
    const isDashboard = pathname.startsWith('/dashboard');
    const isSettings = pathname.startsWith('/settings');
    const isInterview = pathname.startsWith('/interview');
    const isAdmin = pathname.startsWith('/admin');
    const isAdminApi = pathname.startsWith('/api/admin') || pathname.startsWith('/api/owner');
    const isEmployer = pathname.startsWith('/employer');
    const isOwnerRoute = pathname.startsWith('/owner');
    const isLearn = pathname.startsWith('/learn');

    // Redirect to login if accessing protected route without user
    // E2E bypass is ONLY active in local development.
    // Never in staging, preview, or production environments.
    const isE2ETest = (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        request.cookies.get('playwright-e2e')?.value === 'true';
    if (!user && !isE2ETest) {
        if (isAdminApi) {
            return withCorrelationId(clearDiagnosticCookie(NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )));
        }

        // Guest mode check for interview (Query param or Cookie)
        const isGuestMode =
            searchParams.get('demo') === 'true' ||
            request.cookies.get('algomind_demo_mode')?.value === 'true';

        if (isDashboard || isSettings || isAdmin || isEmployer || isOwnerRoute || isLearn) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            // Optionally append a redirect so they come back to the assessment link after login
            url.searchParams.set('redirect', pathname);
            url.searchParams.set('reason', 'auth_required');
            return withCorrelationId(clearDiagnosticCookie(NextResponse.redirect(url)));
        }

        if (isInterview) {
            const { getGlobalFeatureFlag } = await import('@/lib/feature-flags-server');
            const guestModeEnabled = await getGlobalFeatureFlag('ENABLE_GUEST_MODE');

            if (!guestModeEnabled) {
                const url = request.nextUrl.clone();
                url.pathname = '/login';
                url.searchParams.set('redirect', pathname);
                url.searchParams.set('reason', 'guest_disabled');
                return withCorrelationId(clearDiagnosticCookie(NextResponse.redirect(url)));
            }

            if (!isGuestMode) {
                const url = request.nextUrl.clone();
                url.pathname = '/login';
                url.searchParams.set('reason', 'auth_required_interview');
                return withCorrelationId(clearDiagnosticCookie(NextResponse.redirect(url)));
            }
        }
    }

    // Check if user needs to complete diagnostic before accessing learn features
    if (user && supabase && isLearn && !pathname.startsWith('/learn/diagnostic')) {
        const diagnosticCookie = request.cookies.get(DIAGNOSTIC_COMPLETE_COOKIE);

        if (!diagnosticCookie?.value) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('has_completed_diagnostic')
                .eq('id', user.id)
                .single();

            let hasCompletedDiagnostic = Boolean(profile?.has_completed_diagnostic);

            if (!hasCompletedDiagnostic) {
                const { data: conceptStates, error: conceptStateError } = await supabase
                    .from('concept_states')
                    .select('id')
                    .eq('user_id', user.id)
                    .gt('evidence_count', 0)
                    .limit(1);

                hasCompletedDiagnostic = !conceptStateError && (conceptStates?.length ?? 0) > 0;

                if (hasCompletedDiagnostic) {
                    await supabase
                        .from('profiles')
                        .update({ has_completed_diagnostic: true })
                        .eq('id', user.id);
                }
            }

            if (!hasCompletedDiagnostic) {
                const url = request.nextUrl.clone();
                url.pathname = '/learn/diagnostic';
                return withCorrelationId(NextResponse.redirect(url));
            }

            shouldSetDiagnosticCookie = true;
        }
    }

    // Owner/co-owner authorization is handled at the page/route level, not middleware.
    // This reduces redundant DB calls. The owner page performs its own auth check
    // before rendering. Non-owners who navigate to /owner/ will hit the page guard.

    if (!user) {
        clearDiagnosticCookie(supabaseResponse);
    }

    if (shouldSetDiagnosticCookie) {
        supabaseResponse.cookies.set(DIAGNOSTIC_COMPLETE_COOKIE, '1', {
            maxAge: 600,
            httpOnly: true,
            sameSite: 'lax',
            path: '/learn',
        });
    }

    return withCorrelationId(supabaseResponse);
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
