import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { handleCors, addCorsHeaders } from './lib/middleware/cors'

export function middleware(request: NextRequest) {
  // Hanya jalankan middleware pada API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // 1. Handle Preflight Request (OPTIONS)
    // Checks origin and returns empty 204 response with CORS headers if allowed
    const corsResponse = handleCors(request)
    if (corsResponse) {
      return corsResponse
    }

    // 2. Handle Actual Request
    // Create response object (pass through to actual route handler)
    const response = NextResponse.next()
    
    // Add CORS headers to the response so the client browser accepts it
    return addCorsHeaders(response, request)
  }

  // Pass through for non-API routes
  return NextResponse.next()
}

// Configure matcher to match API routes
export const config = {
  matcher: '/api/:path*',
}
