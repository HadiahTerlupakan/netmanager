import { NextResponse } from 'next/server'

/**
 * @swagger
 * /api/geocode/search:
 *   get:
 *     summary: Search location by query
 *     description: Mencari lokasi berdasarkan query menggunakan OpenStreetMap Nominatim API. Hasil dibatasi ke Indonesia.
 *     tags: [Geocode]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (nama tempat, alamat, dll)
 *         example: Jakarta Pusat
 *     responses:
 *       200:
 *         description: Hasil pencarian lokasi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       displayName:
 *                         type: string
 *                         example: Jakarta Pusat, DKI Jakarta, Indonesia
 *                       lat:
 *                         type: number
 *                         example: -6.2088
 *                       lon:
 *                         type: number
 *                         example: 106.8456
 *       400:
 *         description: Query tidak valid
 */
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


