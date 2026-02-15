import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Route-role mapping for authorization
// ---------------------------------------------------------------------------

type UserRole = 'admin' | 'approver' | 'member'

const ADMIN_ONLY_ROUTES = ['/master', '/users', '/payments', '/workflow']
const ADMIN_APPROVER_ROUTES = ['/members', '/approvals', '/fees', '/statistics']
// /applications and /notifications are accessible by all authenticated roles
// /dashboard and /mypage are accessible by all authenticated roles

function getAllowedRoles(pathname: string): UserRole[] | null {
  for (const route of ADMIN_ONLY_ROUTES) {
    if (pathname.startsWith(route)) return ['admin']
  }
  for (const route of ADMIN_APPROVER_ROUTES) {
    if (pathname.startsWith(route)) return ['admin', 'approver']
  }
  // /applications is accessible by all roles (member can view own + create)
  if (pathname.startsWith('/applications')) return ['admin', 'approver', 'member']
  // All other protected routes are accessible by all authenticated users
  return null // null = any authenticated user
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicPaths = ['/login', '/mypage-login']
  const isPublicPath = publicPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // Unauthenticated users → login
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated users on login/root → dashboard
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // --- Role-based route protection ---
  if (user && !isPublicPath && !request.nextUrl.pathname.startsWith('/api/')) {
    const allowedRoles = getAllowedRoles(request.nextUrl.pathname)

    if (allowedRoles) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = (profile?.role as UserRole) ?? 'member'

      if (!allowedRoles.includes(role)) {
        const url = request.nextUrl.clone()
        url.pathname = role === 'member' ? '/mypage' : '/dashboard'
        return NextResponse.redirect(url)
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
