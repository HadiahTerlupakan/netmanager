import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { FinanceAuthService } from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/pengeluaran/[id]
 * Get detail pengeluaran (FINANCE atau ADMIN)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify JWT token using FinanceAuthService
    try {
      const authResult = await FinanceAuthService.authenticate(token)
      if (!authResult.success || !authResult.user) {
        return NextResponse.json({
          error: authResult.error || 'Token tidak valid'
        }, { status: 401 })
      }

      // Verify user has FINANCE or ADMIN role
      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!allowedRoles.includes(authResult.user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const { id } = await params
    const pengeluaranRepo = getPengeluaranRepository()
    const pengeluaran = await pengeluaranRepo.findById(id)

    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(pengeluaran, {
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
 * PUT /api/finance/pengeluaran/[id]
 * Update pengeluaran (FINANCE atau ADMIN)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params
    const body = await request.json()
    const { tanggal, tipePengeluaran, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    if (tipePengeluaran && tipePengeluaran !== 'CAPEX' && tipePengeluaran !== 'OPEX') {
      return NextResponse.json(
        { error: 'Tipe pengeluaran harus CAPEX atau OPEX' },
        { status: 400 }
      )
    }

    const pengeluaranRepo = getPengeluaranRepository()
    
    // Cek apakah pengeluaran ada
    const pengeluaran = await pengeluaranRepo.findById(id)
    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    await pengeluaranRepo.update(id, {
      tanggal,
      tipePengeluaran,
      kategori,
      deskripsi,
      jumlah: jumlah !== undefined ? (typeof jumlah === 'number' ? jumlah.toString() : jumlah) : undefined,
      metodeBayar,
      catatan,
      updatedBy: userId,
    })

    return NextResponse.json({ message: 'Pengeluaran berhasil diupdate' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error updating pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/finance/pengeluaran/[id]
 * Hapus pengeluaran (FINANCE atau ADMIN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = request.headers.get('x-finance-token')

    if (!token) {
      return NextResponse.json({ error: 'Token tidak ditemukan' }, { status: 401 })
    }

    // Verify JWT token using FinanceAuthService
    try {
      const authResult = await FinanceAuthService.authenticate(token)
      if (!authResult.success || !authResult.user) {
        return NextResponse.json({
          error: authResult.error || 'Token tidak valid'
        }, { status: 401 })
      }

      // Verify user has FINANCE or ADMIN role
      const allowedRoles = ['FINANCE', 'ADMIN'] as const
      if (!allowedRoles.includes(authResult.user.role as any)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const { id } = await params
    const pengeluaranRepo = getPengeluaranRepository()
    
    // Cek apakah pengeluaran ada
    const pengeluaran = await pengeluaranRepo.findById(id)
    if (!pengeluaran) {
      return NextResponse.json({ error: 'Pengeluaran tidak ditemukan' }, { status: 404 })
    }

    // Hapus pengeluaran
    await pengeluaranRepo.delete(id)

    return NextResponse.json({ message: 'Pengeluaran berhasil dihapus' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error deleting pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

