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

/**
 * GET /api/ip-info?ip=xxx.xxx.xxx.xxx
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const ip = searchParams.get('ip')

    if (!ip) {
        return apiError('IP address wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
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

        return apiSuccess({
            ip: data.query,
            country: data.country || '-',
            countryCode: data.countryCode || '-',
            region: data.regionName || '-',
            city: data.city || '-',
            isp: data.isp || data.org || '-'
        })
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
