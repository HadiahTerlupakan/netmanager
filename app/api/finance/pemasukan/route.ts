import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/finance/pemasukan
 * List semua pemasukan untuk finance (FINANCE atau ADMIN)
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

    const pemasukanRepo = getPemasukanRepository()

    let pemasukans
    if (kategori) {
      pemasukans = await pemasukanRepo.findByKategori(kategori)
    } else if (startDate && endDate) {
      pemasukans = await pemasukanRepo.findByDateRange(
        new Date(startDate),
        new Date(endDate),
      )
    } else {
      pemasukans = await pemasukanRepo.findAll()
    }

    return NextResponse.json(pemasukans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/finance/pemasukan
 * Create pemasukan baru (FINANCE atau ADMIN)
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

    const pemasukanRepo = getPemasukanRepository()
    // Convert jumlah to string for BigInt conversion in repository
    const jumlahStr = typeof jumlah === 'number' ? jumlah.toString() : jumlah
    const result = await pemasukanRepo.create({
      tanggal,
      kategori,
      deskripsi,
      jumlah: jumlahStr,
      metodeBayar: metodeBayar || null,
      catatan: catatan || null,
      createdBy: userId,
    })

    return NextResponse.json({ id: result.id, message: 'Pemasukan berhasil dibuat' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error creating pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

