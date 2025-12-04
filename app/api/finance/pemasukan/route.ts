import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'

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
    let userId: string | undefined

    if (token) {
      // Verify finance token
      try {
        const tokenData = Buffer.from(token, 'base64').toString('utf8')
        const [uid, timestamp] = tokenData.split(':')
        userId = uid

        if (!userId) {
          return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
        }

        // Check token expiry
        const tokenTime = parseInt(timestamp)
        const now = Date.now()
        const tokenAge = now - tokenTime
        const maxAge = 24 * 60 * 60 * 1000

        if (tokenAge > maxAge) {
          return NextResponse.json({ error: 'Token expired' }, { status: 401 })
        }
      } catch (parseError) {
        return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
      }
    } else {
      // Verify NextAuth session
      const session = await getServerSession(authConfig)
      if (session?.user?.id) {
        userId = session.user.id
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    // Verify user exists and has FINANCE or ADMIN role
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    const allowedRoles = ['FINANCE', 'ADMIN'] as const
    if (!user || !allowedRoles.includes(user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate required fields
    if (!body.tanggal || !body.kategori || !body.deskripsi || !body.jumlah) {
      return NextResponse.json({ error: 'Tanggal, kategori, deskripsi, dan jumlah wajib diisi' }, { status: 400 })
    }
    
    // Validate date format and consistency
    const tanggal = new Date(body.tanggal)
    if (isNaN(tanggal.getTime())) {
      return NextResponse.json({ error: 'Format tanggal tidak valid' }, { status: 400 })
    }
    
    // Check if date is not in future
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    if (tanggal > today) {
      return NextResponse.json({ error: 'Tanggal tidak boleh melebihi hari ini' }, { status: 400 })
    }
    
    // Check if date is not too far in the past (optional validation)
    const minDate = new Date()
    minDate.setFullYear(today.getFullYear() - 5) // Allow transactions up to 5 years ago
    if (tanggal < minDate) {
      return NextResponse.json({ error: 'Tanggal terlalu jauh di masa lalu (maksimal 5 tahun)' }, { status: 400 })
    }
    
    // Validate nomor bukti if provided
    if (body.nomorBukti && body.nomorBukti.trim() === '') {
      return NextResponse.json({ error: 'Nomor bukti tidak boleh kosong jika diisi' }, { status: 400 })
    }
    
    // Check for duplicate nomor bukti
    if (body.nomorBukti) {
      const existingIncome = await (prisma as any).pemasukan.findFirst({
        where: {
          nomorBukti: body.nomorBukti,
        },
      })
      
      if (existingIncome) {
        return NextResponse.json({ error: 'Nomor bukti sudah digunakan' }, { status: 400 })
      }
    }

    const pemasukanRepo = getPemasukanRepository()
    const result = await pemasukanRepo.create({
      ...body,
      createdBy: userId,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error creating income:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

