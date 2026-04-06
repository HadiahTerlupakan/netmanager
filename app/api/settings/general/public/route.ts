import { NextRequest, NextResponse } from 'next/server'
import { getPublicGeneralSettings } from '@/modules/settings'

/**
 * GET /api/settings/general/public
 * Mengambil pengaturan umum untuk keperluan public (invoice, dll)
 * Endpoint ini hanya mengembalikan data perusahaan, alamat, nomor HP, dan deskripsi invoice
 * Tidak memerlukan autentikasi karena data ini untuk keperluan invoice yang bisa diakses publik
 */
export async function GET(_req: NextRequest) {
  try {
    const settings = await getPublicGeneralSettings()
    return NextResponse.json(settings)
  } catch (error: unknown) {
    console.error('Error fetching public general settings:', error)
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}







