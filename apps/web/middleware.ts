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

  // Check if route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))

  if (isPublicRoute) {
    console.log('[Middleware] Public route, allowing access')
    return NextResponse.next()
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  // Check role-based access
  // Fetch user profile to get role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role) {
    // Check if route requires specific role
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
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes (handled separately)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
