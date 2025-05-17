import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          // Re-assign response to ensure it captures cookie changes
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: '', ...options });
          // Re-assign response to ensure it captures cookie changes
          response = NextResponse.next({ request: { headers: req.headers } });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // This will refresh the session cookie if needed, and the cookie handlers above
  // will update `response.cookies`.
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('mode');
  const noRedirect = searchParams.get('noRedirect') === 'true';

  // Log after getSession to see if session status changed due to refresh
  console.log(`Middleware (post-getSession): Path: ${pathname}, Auth: ${session ? 'Authenticated' : 'Not authenticated'}, Mode: ${mode || 'none'}, NoRedirect: ${noRedirect}`);

  // The matcher should prevent this middleware from running on /api/*, _next/*, etc., if configured correctly.
  // If it still runs for /api/*, it will refresh the session and then return the response without redirecting.

  // Skip redirects if noRedirect is set (useful for initial page load after auth actions on client-side)
  if (noRedirect) {
    console.log('Middleware: Skipping redirects due to noRedirect flag');
    return response;
  }

  // --- Redirect logic for non-API routes/pages ---
  if (session) {
    // User is authenticated
    if (pathname === '/auth') {
      console.log('Middleware: Redirecting authenticated user from /auth to /');
      const redirectUrl = new URL('/', req.url);
      if (searchParams.get('noRedirect')) redirectUrl.searchParams.set('noRedirect', 'true');
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // User is not authenticated
    // Ensure we are not on an auth path already to prevent redirect loops
    if (pathname !== '/auth' && !pathname.startsWith('/auth/callback')) { 
      console.log(`Middleware: Redirecting unauthenticated user from ${pathname} to /auth?mode=signin`);
      const redirectUrl = new URL('/auth?mode=signin', req.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Ensure /auth page (if not authenticated) has a mode parameter
  if (pathname === '/auth' && !mode && !session) {
    console.log('Middleware: Adding mode=signin to /auth URL');
    const redirectUrl = new URL('/auth?mode=signin', req.url);
    return NextResponse.redirect(redirectUrl);
  }
  // --- End of redirect logic ---

  return response; // Return the (potentially modified by cookie operations) response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (Supabase auth callback specific path - ADJUST IF YOURS IS DIFFERENT)
     * - api (API routes - they need session but no redirects from here)
     * The goal is for middleware to run on page navigations and server component renders that need auth state,
     * and for API routes to ensure session is refreshed, but not on static assets.
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback|api/).*)',
    '/api/:path*' // Explicitly include API routes for session refresh but they won't be redirected by above logic.
  ],
}; 