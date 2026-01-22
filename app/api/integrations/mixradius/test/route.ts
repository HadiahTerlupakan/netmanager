import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        // @ts-ignore - Node.js specific option for self-signed certs
        rejectUnauthorized: false,
      })
      logs.push(`Login page status: ${loginPageResponse.status}`)
    } catch (e: any) {
      logs.push(`Login page fetch error: ${e.message}`)
      return NextResponse.json({ success: false, logs, error: e.message })
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
        // @ts-ignore
        rejectUnauthorized: false,
      })
      logs.push(`Login response status: ${loginResponse.status}`)
      logs.push(`Login response location: ${loginResponse.headers.get('location')}`)
    } catch (e: any) {
      logs.push(`Login fetch error: ${e.message}`)
      return NextResponse.json({ success: false, logs, error: e.message })
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
      return NextResponse.json({ success: false, logs, error: 'No session cookie' })
    }

    logs.push(`Session cookie: ${sessionCookie.substring(0, 50)}...`)

    // Step 3: Try to fetch data
    logs.push('Step 3: Fetching customer data...')
    
    const dataFormData = new URLSearchParams()
    dataFormData.append('draw', '1')
    dataFormData.append('start', '0')
    dataFormData.append('length', '5')
    dataFormData.append('search[value]', '')
    dataFormData.append('search[regex]', 'false')

    let dataResponse
    try {
      dataResponse = await fetch(`${baseUrl}/rad-get-data/customers-ppp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Cookie': sessionCookie,
          'Referer': `${baseUrl}/rad-customers/ppp`,
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
        body: dataFormData.toString(),
        // @ts-ignore
        rejectUnauthorized: false,
      })
      logs.push(`Data response status: ${dataResponse.status}`)
    } catch (e: any) {
      logs.push(`Data fetch error: ${e.message}`)
      return NextResponse.json({ success: false, logs, error: e.message })
    }

    const rawText = await dataResponse.text()
    logs.push(`Response length: ${rawText.length}`)
    logs.push(`Response preview: ${rawText.substring(0, 200)}...`)

    const isHTML = rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html')
    if (isHTML) {
      logs.push('ERROR: Received HTML response instead of JSON!')
      return NextResponse.json({ success: false, logs, error: 'HTML response - session invalid' })
    }

    try {
      const data = JSON.parse(rawText)
      logs.push(`SUCCESS! Records total: ${data.recordsTotal}`)
      return NextResponse.json({ 
        success: true, 
        logs, 
        recordsTotal: data.recordsTotal,
        sampleData: data.data?.slice(0, 2)
      })
    } catch (e: any) {
      logs.push(`JSON parse error: ${e.message}`)
      return NextResponse.json({ success: false, logs, error: 'Invalid JSON' })
    }

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
