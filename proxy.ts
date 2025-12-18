import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
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

    let response: NextResponse;

    // Rewrite logic
    if (subdomain === 'admin') {
        const newUrl = new URL(`/admin${url.pathname}`, request.url);
        newUrl.search = url.search;
        response = NextResponse.rewrite(newUrl);
    } else if (subdomain === 'karyawan') {
        const newUrl = new URL(`/karyawan${url.pathname}`, request.url);
        newUrl.search = url.search;
        response = NextResponse.rewrite(newUrl);
    } else {
        // Root domain (radpro.id) -> Customer Portal (Default)
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
