import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import { FinanceAuthService } from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/pemasukan/[id]
 * Get pemasukan by ID (FINANCE atau ADMIN)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify JWT token using FinanceAuthService
    const authResult = await FinanceAuthService.authenticate(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        error: authResult.error || 'Unauthorized'
      }, { status: 401 })
    }

    // Verify user has FINANCE or ADMIN permissions
    const hasFinanceAccess = authResult.user?.permissions?.includes('FINANCE') ||
                            authResult.user?.permissions?.includes('ADMIN') ||
                            false
    if (!hasFinanceAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const pemasukanRepo = getPemasukanRepository()
    const pemasukan = await pemasukanRepo.findById(id)

    if (!pemasukan) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json(pemasukan)
  } catch (error: any) {
    console.error('Error fetching pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/finance/pemasukan/[id]
 * Update pemasukan (FINANCE atau ADMIN)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

      // Verify user has FINANCE or ADMIN permissions
      const { getEmployeePermissions } = await import('@/lib/utils/permissions')
      const permissions = await getEmployeePermissions(userId)

      const hasFinanceAccess = permissions?.allowedFeatures?.includes('FINANCE') ||
                              permissions?.allowedFeatures?.includes('ADMIN') ||
                              false

      if (!hasFinanceAccess) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    } catch (parseError) {
      return NextResponse.json({ error: 'Token tidak valid' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { tanggal, kategori, deskripsi, jumlah, metodeBayar, catatan } = body

    const pemasukanRepo = getPemasukanRepository()

    // Check if exists
    const existing = await pemasukanRepo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    await pemasukanRepo.update(id, {
      tanggal,
      kategori,
      deskripsi,
      jumlah: jumlah !== undefined ? (typeof jumlah === 'number' ? jumlah.toString() : jumlah) : undefined,
      metodeBayar: metodeBayar !== undefined ? metodeBayar : undefined,
      catatan: catatan !== undefined ? catatan : undefined,
      updatedBy: userId,
    })

    return NextResponse.json({ message: 'Pemasukan berhasil diupdate' })
  } catch (error: any) {
    console.error('Error updating pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/finance/pemasukan/[id]
 * Delete pemasukan (FINANCE atau ADMIN)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify JWT token using FinanceAuthService
    const authResult = await FinanceAuthService.authenticate(request)
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        error: authResult.error || 'Unauthorized'
      }, { status: 401 })
    }

    // Verify user has FINANCE or ADMIN permissions
    const hasFinanceAccess = authResult.user?.permissions?.includes('FINANCE') ||
                            authResult.user?.permissions?.includes('ADMIN') ||
                            false
    if (!hasFinanceAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { id } = await params
    const pemasukanRepo = getPemasukanRepository()

    // Check if exists
    const existing = await pemasukanRepo.findById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Pemasukan tidak ditemukan' }, { status: 404 })
    }

    await pemasukanRepo.delete(id)

    return NextResponse.json({ message: 'Pemasukan berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

