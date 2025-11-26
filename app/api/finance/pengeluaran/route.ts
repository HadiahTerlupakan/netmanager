import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/finance/pengeluaran
 * List semua pengeluaran untuk finance (FINANCE atau ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify token
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      const [userId] = tokenData.split(':')

      if (!userId) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }

      // Check token expiry
      const [, timestamp] = tokenData.split(':')
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000

      if (tokenAge > maxAge) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }

      // Verify user exists and has FINANCE or ADMIN role
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!user || !allowedRoles.includes(user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const kategori = searchParams.get('kategori')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const pengeluaranRepo = getPengeluaranRepository()

    let pengeluarans
    if (kategori) {
      pengeluarans = await pengeluaranRepo.findByKategori(kategori)
    } else if (startDate && endDate) {
      pengeluarans = await pengeluaranRepo.findByDateRange(
        new Date(startDate),
        new Date(endDate),
      )
    } else {
      pengeluarans = await pengeluaranRepo.findAll()
    }

    return NextResponse.json(pengeluarans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/finance/pengeluaran
 * Create pengeluaran baru (FINANCE atau ADMIN)
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify token
    let userId: string | null = null
    try {
      const tokenData = Buffer.from(token, 'base64').toString('utf8')
      userId = tokenData.split(':')[0]

      if (!userId) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }

      // Check token expiry
      const [, timestamp] = tokenData.split(':')
      const tokenTime = parseInt(timestamp)
      const now = Date.now()
      const tokenAge = now - tokenTime
      const maxAge = 24 * 60 * 60 * 1000

      if (tokenAge > maxAge) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }

      // Verify user exists and has FINANCE or ADMIN role
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!user || !allowedRoles.includes(user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const body = await request.json()
    const { tanggal, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    if (!tanggal || !kategori || !deskripsi || jumlah === undefined) {
      return NextResponse.json(
        { error: 'Tanggal, kategori, deskripsi, dan jumlah wajib diisi' },
        { status: 400 }
      )
    }

    const pengeluaranRepo = getPengeluaranRepository()
    const result = await pengeluaranRepo.create({
      tanggal,
      kategori,
      deskripsi,
      jumlah: parseInt(jumlah),
      metodeBayar: metodeBayar || null,
      catatan: catatan || null,
      createdBy: userId,
    })

    return NextResponse.json({ id: result.id, message: 'Pengeluaran berhasil dibuat' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error creating pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

