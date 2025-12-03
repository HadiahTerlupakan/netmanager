import { NextRequest, NextResponse } from 'next/server'
import { verifyPelangganAccessToken } from '@/lib/jwt'

/**
 * Middleware untuk verifikasi JWT token pelanggan
 * 
 * @param req - NextRequest object
 * @returns NextResponse jika error, atau null jika berhasil
 */
export async function verifyPelangganAuth(req: NextRequest): Promise<NextResponse | null> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token diperlukan' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = verifyPelangganAccessToken(token)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Token tidak valid atau expired' },
        { status: 401 }
      )
    }

    // Add pelanggan data to request headers for downstream use
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-pelanggan-id', decoded.id)
    requestHeaders.set('x-pelanggan-idpelanggan', decoded.idPelanggan)

    // Return modified request
    return null
  } catch (error: any) {
    console.error('Error in pelanggan auth middleware:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * Helper untuk mendapatkan pelanggan ID dari request headers
 */
export function getPelangganIdFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-pelanggan-id')
}

/**
 * Helper untuk mendapatkan ID Pelanggan dari request headers
 */
export function getIdPelangganFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-pelanggan-idpelanggan')
}
