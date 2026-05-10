/**
 * Next.js Middleware for Route Protection
 *
 * Handles:
 * - Session refresh
 * - Protected routes (redirect to /login if not authenticated)
 * - Role-based access control
 * - Public routes (login, forgot-password)
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password']

// Role-based route restrictions
const ROLE_ROUTES: Record<string, string[]> = {
  admin: ['/admin'],
  // Add more role-specific routes as needed
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  console.log('[Middleware] Request:', pathname)

  // Bypass all auth checks in dev/demo mode
  if (process.env.NEXT_PUBLIC_SKIP_AUTH === 'true') {
    return NextResponse.next()
  }

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    console.log('[Middleware] Public route, allowing access')
    return NextResponse.next()
  }

  // Guard: if Supabase env vars are missing, skip auth check
  // (auth-context will handle the redirect client-side)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.warn('[Middleware] Supabase env vars missing, skipping auth check')
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Get user from session
  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log('[Middleware] User:', user?.email || 'not authenticated')

  // Redirect to login if not authenticated
  if (!user) {
    console.log('[Middleware] No user, redirecting to /login')
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Check role-based access — profiles table uses user_id column
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (profile?.role) {
    for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
      if (routes.some(route => pathname.startsWith(route))) {
        if (profile.role !== role) {
          console.log('[Middleware] Insufficient permissions, redirecting to /')
          return NextResponse.redirect(new URL('/', request.url))
        }
      }
    }
  }

  console.log('[Middleware] Access granted')
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api và /api/* — Express + JWT; không redirect HTML login lên API
     * - _next/static, _next/image, favicon, ảnh tĩnh
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
