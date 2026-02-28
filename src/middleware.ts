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

    // ⚠️ CRITICAL: Must use NEXT_PUBLIC_SUPABASE_URL (same as client).
    // Cookie names are derived from the URL — mixing URLs breaks session sync.
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
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

    // Refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const { data: { user } } = await supabase.auth.getUser();

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
    // Bypass for Playwright E2E testing to allow client-side mocking
    const isE2ETest = process.env.NODE_ENV !== 'production' &&
        request.cookies.get('playwright-e2e')?.value === 'true';
    if (!user && !isE2ETest) {
        if (isDashboard || isSettings || isAdmin || isEmployer || isAssess || isOwnerRoute) {
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

        // Also check co_owners table
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

    // ROUTING-001: Employer account type redirect
    // If authenticated user is on dashboard or home, check if they're an employer
    if (user && (isDashboard || pathname === '/')) {
        let accountType = user.app_metadata?.account_type || user.user_metadata?.account_type;

        if (!accountType) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('account_type')
                .eq('id', user.id)
                .single();
            accountType = profile?.account_type;
        }

        if (accountType === 'employer') {
            const url = request.nextUrl.clone();
            url.pathname = '/employer/dashboard';
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
        '/((?!_next/static|_next/image|favicon.ico|public/|vad/|api/auth/).*)',
    ],
};
