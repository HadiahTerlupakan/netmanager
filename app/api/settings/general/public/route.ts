import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/settings/general/public
 * Mengambil pengaturan umum untuk keperluan public (invoice, dll)
 * Endpoint ini hanya mengembalikan data perusahaan, alamat, nomor HP, dan deskripsi invoice
 * Tidak memerlukan autentikasi karena data ini untuk keperluan invoice yang bisa diakses publik
 */
export async function GET(req: NextRequest) {
  try {
    // Ambil pengaturan umum yang diperlukan untuk invoice
    const settings = await prisma.settings.findMany({
      where: {
        key: {
          in: [
            'GENERAL_PERUSAHAAN',
            'GENERAL_ALAMAT',
            'GENERAL_NOMOR_HP',
            'GENERAL_DESKRIPSI_INVOICE',
          ],
        },
      },
    })

    // Convert ke object
    const settingsMap = new Map(settings.map((s) => [s.key, s.value]))

    return NextResponse.json({
      perusahaan: settingsMap.get('GENERAL_PERUSAHAAN') || '',
      alamat: settingsMap.get('GENERAL_ALAMAT') || '',
      nomorHp: settingsMap.get('GENERAL_NOMOR_HP') || '',
      deskripsiInvoice: settingsMap.get('GENERAL_DESKRIPSI_INVOICE') || '',
    })
  } catch (error: any) {
    console.error('Error fetching public general settings:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

