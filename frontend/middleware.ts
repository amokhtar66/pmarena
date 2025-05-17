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
          // If the cookie is set, update the request and response cookies
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          // If the cookie is removed, update the request and response cookies
          req.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Refresh session if expired - crucial for keeping user authenticated for API routes
  const { data: { session } } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('mode');
  const noRedirect = searchParams.get('noRedirect') === 'true';

  console.log(`Middleware: Path: ${pathname}, Auth: ${session ? 'Authenticated' : 'Not authenticated'}, Mode: ${mode || 'none'}, NoRedirect: ${noRedirect}`);

  // Skip further processing for specific paths if needed, e.g., API routes or static assets if not covered by matcher
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image') || pathname.includes('favicon.ico')) {
    return response; 
  }
  
  // Skip redirects if noRedirect is set (useful for initial page load after auth actions on client-side)
  if (noRedirect) {
    console.log('Middleware: Skipping redirects due to noRedirect flag');
    return response;
  }

  // Handle redirects based on authentication state and path
  if (session) {
    // User is authenticated
    if (pathname === '/auth') {
      console.log('Middleware: Redirecting authenticated user from /auth to /');
      const redirectUrl = new URL('/', req.url); // Redirect to home
      // Preserve noRedirect if it was initially set for some reason, though less likely here
      if (searchParams.get('noRedirect')) redirectUrl.searchParams.set('noRedirect', 'true');
      return NextResponse.redirect(redirectUrl);
    }
  } else {
    // User is not authenticated
    if (pathname !== '/auth' && !pathname.startsWith('/auth/callback')) { // Avoid redirect loops for /auth and callback
      console.log(`Middleware: Redirecting unauthenticated user from ${pathname} to /auth?mode=signin`);
      const redirectUrl = new URL('/auth?mode=signin', req.url);
      // Preserve original path for potential redirect after login if needed, e.g. redirectUrl.searchParams.set('redirectedFrom', pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Ensure /auth page has a mode parameter if accessed directly without one (and user not authenticated)
  if (pathname === '/auth' && !mode && !session) {
    console.log('Middleware: Adding mode=signin to /auth URL');
    const redirectUrl = new URL('/auth?mode=signin', req.url);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - auth/callback (Supabase auth callback specific path, if any)
     * This pattern aims to cover all pages and API routes that might need session info.
     */
    '/((?!_next/static|_next/image|favicon.ico|auth/callback).*)',
  ],
}; 