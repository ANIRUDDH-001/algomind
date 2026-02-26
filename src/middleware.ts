import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export default async function middleware(request: NextRequest) {
    // 1. Supabase Proxy OPTIONS Preflight
    if (request.method === 'OPTIONS' && request.nextUrl.pathname.startsWith('/supabase-proxy/')) {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Access-Control-Max-Age': '86400',
            },
        });
    }

    // 2. Supabase Proxy (bypass DNS/Mobile blocking)
    if (request.nextUrl.pathname.startsWith('/supabase-proxy/')) {
        const url = new URL(request.url);
        // Replace /supabase-proxy/ with the actual path
        const targetPath = url.pathname.replace(/^\/supabase-proxy/, '');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (!supabaseUrl) {
            return new NextResponse('Supabase URL not configured', { status: 500 });
        }

        const targetUrl = new URL(targetPath + url.search, supabaseUrl);
        const supabaseHost = new URL(supabaseUrl).host;

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('Host', supabaseHost);
        requestHeaders.delete('x-forwarded-host');
        requestHeaders.delete('x-forwarded-port');

        const isBodyAllowed = !['GET', 'HEAD'].includes(request.method);

        const requestInit: RequestInit = {
            method: request.method,
            headers: requestHeaders,
        };

        if (isBodyAllowed) {
            requestInit.body = request.body as any;
            // @ts-expect-error duplex is required for Next.js edge stream forwarding
            requestInit.duplex = 'half';
        }

        try {
            const response = await fetch(targetUrl.toString(), requestInit);

            // Create a new response to modify headers, preserve status
            const proxyResponse = new NextResponse(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
            });

            proxyResponse.headers.set('Access-Control-Allow-Origin', '*');
            proxyResponse.headers.set('Access-Control-Allow-Credentials', 'true');
            proxyResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            proxyResponse.headers.set('Access-Control-Allow-Headers', '*');

            return proxyResponse;
        } catch (error) {
            console.error('Supabase Proxy Error:', error);
            return new NextResponse('Proxy failed', { status: 502 });
        }
    }

    let supabaseResponse = NextResponse.next({ request });

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
                        request,
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
    const { pathname, searchParams } = request.nextUrl;

    // Define protected paths
    const isDashboard = pathname.startsWith('/dashboard');
    const isSettings = pathname.startsWith('/settings');
    const isInterview = pathname.startsWith('/interview');
    const isAdmin = pathname.startsWith('/admin');
    const isEmployer = pathname.startsWith('/employer');
    const isAssess = pathname.startsWith('/assess');

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
        if (isDashboard || isSettings || isAdmin || isEmployer || isAssess) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            // Optionally append a redirect so they come back to the assesment link after login
            url.searchParams.set('redirect', pathname);
            return NextResponse.redirect(url);
        }

        if (isInterview && !isGuestMode) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
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
