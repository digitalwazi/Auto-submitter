import { NextResponse } from 'next/server'

export function middleware(request) {
    // Define public paths that don't satisfy the check
    const publicPaths = [
        '/_next',
        '/static',
        '/api/auth',
        '/login',
        '/favicon.ico',
        '/images', // Assume images are public
    ]

    const { pathname } = request.nextUrl

    // Check if path is public
    if (publicPaths.some((path) => pathname.startsWith(path))) {
        return NextResponse.next()
    }

    // Check for auth cookie
    const authCookie = request.cookies.get('auth')
    const isAuthenticated = authCookie?.value === 'true'

    if (!isAuthenticated) {
        const loginUrl = new URL('/login', request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes) -> actually we want to protect API routes too, except auth
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
}
