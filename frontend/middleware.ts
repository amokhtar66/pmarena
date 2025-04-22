import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export async function middleware(req: NextRequest) {
  try {
    // Create a response to modify
    const res = NextResponse.next()
    
    // Create a Supabase client configured to use cookies
    const supabase = createMiddlewareClient({ req, res })

    // Check if we have a session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Get the pathname and searchParams
    const { pathname } = req.nextUrl
    const searchParams = req.nextUrl.searchParams
    const mode = searchParams.get('mode')
    const noRedirect = searchParams.get('noRedirect') === 'true'

    // Debug info
    console.log(`Middleware running - Path: ${pathname}, Auth: ${session ? 'Authenticated' : 'Not authenticated'}, Mode: ${mode || 'none'}, NoRedirect: ${noRedirect}`)

    // Skip redirects if noRedirect is set
    if (noRedirect) {
      console.log('Skipping redirects due to noRedirect flag')
      return res
    }

    // Authenticated users should be redirected to home
    if (session && pathname === '/auth') {
      console.log('Redirecting to / - User is authenticated')
      const redirectUrl = new URL('/?source=auth_redirect', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Unauthenticated users should be redirected to auth
    if (!session && pathname === '/') {
      console.log('Redirecting to /auth - User not authenticated')
      const redirectUrl = new URL('/auth?mode=signin', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Ensure auth page has mode parameter
    if (pathname === '/auth' && !mode) {
      console.log('Adding mode parameter to /auth URL')
      const redirectUrl = new URL('/auth?mode=signin', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}

// Specify which routes this middleware should run on
export const config = {
  matcher: ['/', '/auth'],
} 