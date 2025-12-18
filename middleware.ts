import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const url = request.nextUrl;
    const hostname = request.headers.get('host') || '';

    // Define domains (you can also load these from env)
    // We assume the app is running on radpro.id in production
    // or localhost in dev.

    // Logic to determine current subdomain
    // e.g., admin.radpro.id -> subdomain = 'admin'
    // e.g., karyawan.radpro.id -> subdomain = 'karyawan'

    // Adjust this domain constants
    const currentHost = hostname.replace(`.${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`, '');
    // Note: if simple split is preferred:
    const parts = hostname.split('.');

    // Checking for subdomain
    // If running on localhost:3000, host is localhost:3000. parts[0] is localhost.
    // If running on admin.radpro.id, parts[0] is admin.

    // NOTE: Simple check for 'admin' or 'karyawan' at the start of the host
    const isProd = process.env.NODE_ENV === 'production';
    const rootDomain = 'radpro.id'; // Hardcoded as per request or use Env

    let subdomain = null;

    if (hostname.includes(rootDomain)) {
        const hostParts = hostname.replace(rootDomain, '').split('.');
        // admin.radpro.id -> ['admin', ''] or similar depending on trailing dot
        // clean logic:
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
        return NextResponse.next();
    }

    // Rewrite logic
    if (subdomain === 'admin') {
        // Rewrite to /admin path if not already there to prevent infinite loops (though next rewrites don't change browser URL)
        // Actually, if we rewrite, the page.tsx inside /app/admin will be rendered.
        // But if the user navigates to /admin directly on root, they also see it.
        // We want mapping: admin.domain.com/dashboard -> domain.com/admin/dashboard

        // If the path already holds /admin, we don't need to prepend it, but usually the structure is:
        // admin.domain.com/ => rewrites to /admin
        // admin.domain.com/settings => rewrites to /admin/settings

        // Let's prepend /admin if it's not present? 
        // Wait, the project structure is: /app/admin, /app/karyawan.

        // If user visits admin.radpro.id/login, rewrite to /admin/login
        // If user visits admin.radpro.id/, rewrite to /admin

        // We must be careful not to double rewrite if internal logic redirects.

        const newUrl = new URL(`/admin${url.pathname}`, request.url);
        // Preserve search params
        newUrl.search = url.search;
        return NextResponse.rewrite(newUrl);
    }

    if (subdomain === 'karyawan') {
        const newUrl = new URL(`/karyawan${url.pathname}`, request.url);
        newUrl.search = url.search;
        return NextResponse.rewrite(newUrl);
    }

    // Root domain (radpro.id) -> Customer Portal
    // The customer portal is likely at (customer) group or root page?
    // User said: "portal pelanggan ada di root domain radpro.id"
    // If the customer pages are in (customer) group, they are accessible at root / path.
    // So no rewrite needed for root domain, assuming /app/page.tsx or /app/(customer)/page.tsx is the landing.

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
