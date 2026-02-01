import { NextRequest } from 'next/server'
import { apiSuccess, ErrorCodes, apiError } from '@/lib/api-response'

interface IpApiResponse {
    status: string
    country?: string
    countryCode?: string
    regionName?: string
    city?: string
    isp?: string
    org?: string
    query: string
    message?: string
}

interface IpInfoResult {
    ip: string
    country: string
    countryCode: string
    region?: string
    city: string
    isp: string
}

interface IpCacheEntry {
    data: IpInfoResult
    expiresAt: number
}

// Simple in-memory cache
// ip-api.com has a strict 45 req/min limit. Caching prevents 429 errors.
const ipCache = new Map<string, IpCacheEntry>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

/**
 * GET /api/ip-info?ip=xxx.xxx.xxx.xxx
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const ip = searchParams.get('ip')

    if (!ip) {
        return apiError('IP address wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    // Check Cache
    const cached = ipCache.get(ip)
    if (cached && cached.expiresAt > Date.now()) {
        return apiSuccess(cached.data)
    }

    if (ip === '127.0.0.1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
        return apiSuccess({
            ip,
            country: 'Local',
            countryCode: '-',
            isp: 'Private Network',
            city: '-'
        })
    }

    try {
        const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,isp,org,query`)
        const data: IpApiResponse = await res.json()

        if (data.status === 'fail') {
            return apiSuccess({
                ip,
                country: '-',
                countryCode: '-',
                isp: data.message || 'Unknown',
                city: '-'
            })
        }

        const resultData = {
            ip: data.query,
            country: data.country || '-',
            countryCode: data.countryCode || '-',
            region: data.regionName || '-',
            city: data.city || '-',
            isp: data.isp || data.org || '-'
        }

        // Cache the successful result
        ipCache.set(ip, {
            data: resultData,
            expiresAt: Date.now() + CACHE_TTL
        })

        // Simple cache cleanup (prevent memory leak)
        if (ipCache.size > 1000) {
            const now = Date.now()
            for (const [key, val] of ipCache.entries()) {
                if (val.expiresAt < now) ipCache.delete(key)
            }
        }

        return apiSuccess(resultData)
    } catch (error) {
        console.error('Error fetching IP info:', error)
        return apiSuccess({
            ip,
            country: '-',
            countryCode: '-',
            isp: 'Error',
            city: '-'
        })
    }
}
