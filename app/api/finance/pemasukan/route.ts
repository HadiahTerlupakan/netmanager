import { NextRequest, NextResponse } from 'next/server'
import { getPemasukanRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import FinanceAuthService from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/pemasukan
 * List semua pemasukan untuk finance (FINANCE atau ADMIN)
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate using secure FinanceAuthService
    const authResult = await FinanceAuthService.authenticate(request)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        error: authResult.error || 'Unauthorized'
      }, { status: 401 })
    }

    // Verify user has FINANCE or ADMIN role
    const allowedRoles = ['FINANCE', 'ADMIN'] as const
    if (!allowedRoles.includes(authResult.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const pemasukanRepo = getPemasukanRepository()

    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const kategori = searchParams.get('kategori')
    const search = searchParams.get('search')

    // Get pemasukan with filters
    let items
    if (startDateStr || endDateStr || kategori || search) {
      const startDate = startDateStr ? new Date(startDateStr) : undefined
      const endDate = endDateStr ? new Date(endDateStr) : undefined

      if (startDate && endDate) {
        items = await pemasukanRepo.findByDateRange(startDate, endDate)
      } else if (kategori) {
        items = await pemasukanRepo.findByKategori(kategori)
      } else {
        items = await pemasukanRepo.findAll()
      }

      // Apply search filter if provided
      if (search && items) {
        const searchLower = search.toLowerCase()
        items = items.filter(item =>
          item.deskripsi?.toLowerCase().includes(searchLower) ||
          item.kategori?.toLowerCase().includes(searchLower)
        )
      }
    } else {
      items = await pemasukanRepo.findAll()
    }

    return NextResponse.json(items, {
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
    // Authenticate using secure FinanceAuthService
    const authResult = await FinanceAuthService.authenticate(request)

    if (!authResult.success || !authResult.user) {
      return NextResponse.json({
        error: authResult.error || 'Unauthorized'
      }, { status: 401 })
    }

    // Verify user has FINANCE or ADMIN role
    const allowedRoles = ['FINANCE', 'ADMIN'] as const
    if (!allowedRoles.includes(authResult.user.role as any)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const userId = authResult.user.id
    const pemasukanRepo = getPemasukanRepository()
    const body = await request.json()

    // Validate required fields
    const { tanggal, kategori, deskripsi, jumlah } = body
    if (!tanggal || !kategori || !deskripsi || jumlah === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: tanggal, kategori, deskripsi, jumlah' },
        { status: 400 }
      )
    }

    // Check for duplicate nomor bukti if provided
    if (body.nomorBukti) {
      const existingIncome = await prisma.pemasukan.findFirst({
        where: { nomorBukti: body.nomorBukti },
      })

      if (existingIncome) {
        return NextResponse.json(
          { error: 'Nomor bukti sudah digunakan' },
          { status: 409 }
        )
      }
    }

    // Create pemasukan with audit trail
    const result = await pemasukanRepo.create({
      ...body,
      createdBy: userId,
    })

    // Log financial access for audit
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user,
      'CREATE',
      'PEMASUKAN',
      {
        id: result.id,
        jumlah: body.jumlah,
        kategori: body.kategori
      }
    )

    return NextResponse.json(
      { success: true, id: result.id, message: 'Pemasukan created successfully' },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Error creating pemasukan:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
