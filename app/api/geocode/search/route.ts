import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()
    if (!q) return NextResponse.json({ results: [] })

    // Batasi hasil ke Indonesia dengan countrycodes=id. Bisa ditambah bounding box jika diperlukan.
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&limit=5&countrycodes=id`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'NetManager/1.0 (geocode-search)' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({ results: [] })
    const data = await res.json()
    const results = (Array.isArray(data) ? data : []).map((r: any) => ({
      displayName: r?.display_name,
      lat: r?.lat ? Number(r.lat) : null,
      lon: r?.lon ? Number(r.lon) : null,
    })).filter((r: any) => r.lat != null && r.lon != null)
    return NextResponse.json({ results })
  } catch (e) {
    return NextResponse.json({ results: [] })
  }
}


