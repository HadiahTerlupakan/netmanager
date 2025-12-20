import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function proxy(request: NextRequest) {
    const url = request.nextUrl;
    const hostname = request.headers.get('host') || '';

    // Security Headers
    // Adopted from previous proxy.ts to maintain security posture
    const responseHeaders = new Headers(request.headers);
    responseHeaders.set('X-Frame-Options', 'DENY');
    responseHeaders.set('X-Content-Type-Options', 'nosniff');
    responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    responseHeaders.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: ws: wss:;"
    );

    // Subdomain Logic
    const rootDomain = 'radpro.id'; // Hardcoded as per request
    let subdomain = null;

    if (hostname.includes(rootDomain)) {
        if (hostname.startsWith('admin.')) subdomain = 'admin';
        if (hostname.startsWith('karyawan.')) subdomain = 'karyawan';
    }

    // Prevent rewriting for API routes, static files, etc.
    if (
        url.pathname.startsWith('/api') ||
        url.pathname.startsWith('/_next') ||
        url.pathname.startsWith('/static') ||
        url.pathname.includes('.') // public files like favicon.ico
    ) {
        const res = NextResponse.next({
            request: {
                headers: responseHeaders,
            },
        });
        // Apply headers to response as well
        res.headers.set('X-Frame-Options', 'DENY');
        res.headers.set('X-Content-Type-Options', 'nosniff');
        res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        return res;
    }

    // Verify Token for Portal Access
    // We use next-auth/jwt to check the session token directly at the edge/proxy level
    // This prevents session leakage between portals
    const token = await getToken({ req: request });

    let response: NextResponse;

    // Reject unauthorized access to Admin Subdomain
    if (subdomain === 'admin') {
        const isLoginPage = url.pathname.startsWith('/login') || url.pathname === '/'; // Allow root for redirect? No, root is dashboard usually.
        // Actually, logic below rewrites / to /admin/

        // If not on login page, check permissions
        if (!url.pathname.includes('/login') && !url.pathname.startsWith('/api')) { // simple check
            if (!token?.accessAdminPanel && token?.role !== 'SUPER_ADMIN') {
                // Determine redirect URL
                const loginUrl = new URL('/login', request.url);
                loginUrl.searchParams.set('error', 'AccessDenied');
                return NextResponse.redirect(loginUrl);
            }
        }
    }

    // Reject unauthorized access to Employee Subdomain
    if (subdomain === 'karyawan') {
        // If not on login page, check permissions
        if (!url.pathname.includes('/login') && !url.pathname.startsWith('/api')) {
            if (!token?.accessEmployeePanel && token?.role !== 'SUPER_ADMIN') {
                const loginUrl = new URL('/login', request.url);
                loginUrl.searchParams.set('error', 'AccessDenied');
                return NextResponse.redirect(loginUrl);
            }
        }
    }

    // Rewrite logic
    if (subdomain === 'admin') {
        let rewritePath = url.pathname;
        if (!rewritePath.startsWith('/admin')) {
            rewritePath = `/admin${rewritePath}`;
        }
        const newUrl = new URL(rewritePath, request.url);
        newUrl.search = url.search;
        response = NextResponse.rewrite(newUrl);
    } else if (subdomain === 'karyawan') {
        let rewritePath = url.pathname;
        if (!rewritePath.startsWith('/karyawan')) {
            rewritePath = `/karyawan${rewritePath}`;
        }
        const newUrl = new URL(rewritePath, request.url);
        newUrl.search = url.search;
        response = NextResponse.rewrite(newUrl);
    } else {
        // Root domain (radpro.id) -> Customer Portal (Default)
        // Check direct path access (e.g. radpro.id/admin) - prevent bypass if user tries to access /admin directly without subdomain
        // Although layout protection covers this, edge protection is better.

        if (url.pathname.startsWith('/admin')) {
            if (!token?.accessAdminPanel && token?.role !== 'SUPER_ADMIN' && !url.pathname.includes('/login')) {
                return NextResponse.redirect(new URL('/admin/login', request.url));
            }
        }
        if (url.pathname.startsWith('/karyawan')) {
            if (!token?.accessEmployeePanel && token?.role !== 'SUPER_ADMIN' && !url.pathname.includes('/login')) {
                return NextResponse.redirect(new URL('/karyawan/login', request.url));
            }
        }

        response = NextResponse.next();
    }

    // Apply Security Headers to the final response
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https: ws: wss:;"
    );

    return response;
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
