import { apiSuccess, ApiErrors, ErrorCodes, apiError } from '@/lib/api-response'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    if (!lat || !lon) {
      return apiError('lat dan lon wajib diisi', ErrorCodes.VALIDATION_ERROR, { status: 400 })
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NetManager/1.0 (reverse-geocode)'
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      return apiError('Gagal reverse geocoding', ErrorCodes.EXTERNAL_SERVICE_ERROR, { status: 502 })
    }
    const data = await res.json()
    return apiSuccess({
      displayName: data?.display_name || null,
      address: data?.address || null,
    })
  } catch (e: any) {
    return ApiErrors.internalError('Terjadi kesalahan')
  }
}
