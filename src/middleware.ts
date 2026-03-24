import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

    let user: { id: string; email?: string; app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } | null = null;
    const { data } = await supabase.auth.getUser();
    user = data.user;

    // Route Protection Logic
    const { searchParams } = request.nextUrl;

    // Define protected paths
    const isDashboard = pathname.startsWith('/dashboard');
    const isSettings = pathname.startsWith('/settings');
    const isInterview = pathname.startsWith('/interview');
    const isAdmin = pathname.startsWith('/admin');
    const isEmployer = pathname.startsWith('/employer');
    const isEmployerAPI = pathname.startsWith('/api/employer');
    const isAssess = pathname.startsWith('/assess');
    const isOwnerRoute = pathname.startsWith('/owner');
    const isLearn = pathname.startsWith('/learn');

    // Gate employer tier if feature flag is disabled
    const enableEmployerTier = process.env.ENABLE_EMPLOYER_TIER === 'true';
    if (!enableEmployerTier && (isEmployer || isEmployerAPI)) {
        if (isEmployer) {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return NextResponse.redirect(url);
        }
        if (isEmployerAPI) {
            return NextResponse.json({ error: 'Not available' }, { status: 404 });
        }
    }

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
            url.searchParams.set('reason', 'auth_required');
            return NextResponse.redirect(url);
        }

        if (isInterview && !isGuestMode) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('reason', 'auth_required_interview');
            return NextResponse.redirect(url);
        }
    }

    // Check if user needs to complete diagnostic before accessing learn features
    if (user && isLearn && pathname === '/learn') {
        const { data: profile } = await supabase
            .from('profiles')
            .select('has_completed_diagnostic')
            .eq('id', user.id)
            .single();
        
        if (!profile?.has_completed_diagnostic) {
            const url = request.nextUrl.clone();
            url.pathname = '/learn/diagnostic';
            return NextResponse.redirect(url);
        }
    }

    // Owner/co-owner authorization is handled at the page/route level, not middleware.
    // This reduces redundant DB calls. The owner page performs its own auth check
    // before rendering. Non-owners who navigate to /owner/ will hit the page guard.

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
