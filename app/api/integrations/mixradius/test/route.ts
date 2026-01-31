import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth'
import { apiSuccess, ApiErrors } from '@/lib/api-response'

/**
 * GET /api/integrations/mixradius/test
 * 
 * Test endpoint untuk debug MixRadius login
 */
export async function GET(req: NextRequest) {
  try {
    // Auth check
    const session = await verifyAuth(req)
    if (!session) {
      return ApiErrors.unauthorized()
    }

    const baseUrl = process.env.MIXRADIUS_URL || 'https://sblnet.topsetting.com:973'
    const username = process.env.MIXRADIUS_USERNAME || 'rudihartono'
    const password = process.env.MIXRADIUS_PASSWORD || 'rudihartono12#'

    const logs: string[] = []
    logs.push(`Base URL: ${baseUrl}`)
    logs.push(`Username: ${username}`)

    // Step 1: Get login page
    logs.push('Step 1: Fetching login page...')
    
    let loginPageResponse
    try {
      loginPageResponse = await fetch(`${baseUrl}/rad-admin`, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
        // @ts-expect-error - Node.js specific option for self-signed certs
        rejectUnauthorized: false,
      })
      logs.push(`Login page status: ${loginPageResponse.status}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      logs.push(`Login page fetch error: ${message}`)
      return apiSuccess({ success: false, logs, error: message })
    }

    // Get cookies
    const setCookieHeaders = loginPageResponse.headers.getSetCookie?.() || []
    const initialCookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ')
    logs.push(`Initial cookies (${setCookieHeaders.length}): ${initialCookies}`)

    // Step 2: Submit login
    logs.push('Step 2: Submitting login form...')

    const formData = new URLSearchParams()
    formData.append('username', username)
    formData.append('password', password)

    let loginResponse
    try {
      loginResponse = await fetch(`${baseUrl}/rad-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Cookie': initialCookies,
          'Referer': `${baseUrl}/rad-admin`,
          'Origin': baseUrl,
        },
        body: formData.toString(),
        redirect: 'manual',
        // @ts-expect-error - Node.js specific option for self-signed certs
        rejectUnauthorized: false,
      })
      logs.push(`Login response status: ${loginResponse.status}`)
      logs.push(`Login response location: ${loginResponse.headers.get('location')}`)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      logs.push(`Login fetch error: ${message}`)
      return apiSuccess({ success: false, logs, error: message })
    }

    // Get session cookie
    const loginSetCookies = loginResponse.headers.getSetCookie?.() || []
    logs.push(`Login set-cookie headers count: ${loginSetCookies.length}`)

    let sessionCookie = ''
    for (const cookie of loginSetCookies) {
      logs.push(`Cookie header: ${cookie.substring(0, 80)}...`)
      const match = cookie.match(/Mixradius_Session=([^;]+)/)
      if (match) {
        sessionCookie = `Mixradius_Session=${match[1]}`
        logs.push(`Found session cookie!`)
        break
      }
    }

    if (!sessionCookie) {
      // Try fallback
      const fallbackCookie = loginResponse.headers.get('set-cookie') || ''
      logs.push(`Fallback set-cookie: ${fallbackCookie.substring(0, 80)}...`)
      const match = fallbackCookie.match(/Mixradius_Session=([^;]+)/)
      if (match) {
        sessionCookie = `Mixradius_Session=${match[1]}`
      }
    }

    if (!sessionCookie) {
      logs.push('ERROR: No session cookie found!')
      return apiSuccess({ success: false, logs, error: 'No session cookie' })
    }

    logs.push(`Session cookie: ${sessionCookie.substring(0, 50)}...`)

    // Step 3: Fetch Dashboard to find links
    logs.push('Step 3: Fetching Dashboard to find Active Sessions link...')

    let pageResponse
    try {
      pageResponse = await fetch(`${baseUrl}/rad-admin`, {
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Cookie': sessionCookie
        },
        // @ts-expect-error - Node.js specific option for self-signed certs
        rejectUnauthorized: false
      })
      logs.push(`Page response status: ${pageResponse.status}`)
    } catch (e: unknown) {
       const message = e instanceof Error ? e.message : 'Unknown error'
       logs.push(`Page fetch error: ${message}`)
       return apiSuccess({ success: false, logs, error: message })
    }

    const pageHtml = await pageResponse.text()
    logs.push(`Page HTML length: ${pageHtml.length}`)

    // Search for links containing "active", "online", "session"
    const links = pageHtml.match(/<a[^>]+href="([^"]*)"[^>]*>([^<]*(?:active|online|session)[^<]*)<\/a>/gi)
    if (links) {
        logs.push(`Found ${links.length} potential links:`)
        links.forEach(l => logs.push(l))
    } else {
        logs.push('No obvious links found. Dumping all hrefs...')
        const hrefs = pageHtml.match(/href="([^"]*)"/g)
        if (hrefs) {
             logs.push(`Found ${hrefs.length} hrefs. Sample: ${hrefs.slice(0, 10).join(', ')}`)
        }
    }

    return apiSuccess({ success: true, logs })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error'
    return ApiErrors.internalError(message)
  }
}
