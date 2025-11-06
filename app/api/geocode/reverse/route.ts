import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const lat = searchParams.get('lat')
    const lon = searchParams.get('lon')
    if (!lat || !lon) {
      return NextResponse.json({ error: 'lat dan lon wajib diisi' }, { status: 400 })
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
      lat
    )}&lon=${encodeURIComponent(lon)}&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        // Nominatim meminta identifikasi aplikasi. Sesuaikan jika perlu.
        'User-Agent': 'NetManager/1.0 (reverse-geocode)'
      },
      // Hindari cache agar selalu update
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Gagal reverse geocoding' }, { status: 502 })
    }
    const data = await res.json()
    return NextResponse.json({
      displayName: data?.display_name || null,
      address: data?.address || null,
    })
  } catch (e: any) {
    return NextResponse.json({ error: 'Terjadi kesalahan' }, { status: 500 })
  }
}


