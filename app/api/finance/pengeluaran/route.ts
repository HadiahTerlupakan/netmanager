import { NextRequest, NextResponse } from 'next/server'
import { getPengeluaranRepository } from '@/lib/repositories'
import { prisma } from '@/lib/prisma'
import FinanceAuthService from '@/lib/services/FinanceAuthService'

/**
 * GET /api/finance/pengeluaran
 * List semua pengeluaran untuk finance (FINANCE atau ADMIN)
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

    // Verify user has FINANCE or ADMIN permissions
    const hasFinanceAccess = authResult.user?.permissions?.includes('FINANCE') ||
                            authResult.user?.permissions?.includes('ADMIN') ||
                            false
    if (!hasFinanceAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const pengeluaranRepo = getPengeluaranRepository()

    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')
    const kategori = searchParams.get('kategori')
    const search = searchParams.get('search')

    // Get pengeluaran with filters
    let items
    if (startDateStr || endDateStr || kategori || search) {
      const startDate = startDateStr ? new Date(startDateStr) : undefined
      const endDate = endDateStr ? new Date(endDateStr) : undefined

      if (startDate && endDate) {
        items = await pengeluaranRepo.findByDateRange(startDate, endDate)
      } else if (kategori) {
        items = await pengeluaranRepo.findByKategori(kategori)
      } else {
        items = await pengeluaranRepo.findAll()
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
      items = await pengeluaranRepo.findAll()
    }

    return NextResponse.json(items, {
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
    // Authenticate using secure FinanceAuthService
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

    const userId = authResult.user.id
    const pengeluaranRepo = getPengeluaranRepository()
    const body = await request.json()

    // Validate required fields
    const { tanggal, kategori, deskripsi, jumlah } = body
    if (!tanggal || !kategori || !deskripsi || jumlah === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: tanggal, kategori, deskripsi, jumlah' },
        { status: 400 }
      )
    }

    // Validate tipePengeluaran if provided
    if (body.tipePengeluaran && body.tipePengeluaran !== 'CAPEX' && body.tipePengeluaran !== 'OPEX') {
      return NextResponse.json(
        { error: 'Tipe pengeluaran harus CAPEX atau OPEX' },
        { status: 400 }
      )
    }

    // Check for duplicate nomor bukti if provided
    if (body.nomorBukti) {
      const existingExpense = await prisma.pengeluaran.findFirst({
        where: { nomorBukti: body.nomorBukti },
      })

      if (existingExpense) {
        return NextResponse.json(
          { error: 'Nomor bukti sudah digunakan' },
          { status: 409 }
        )
      }
    }

    // Create pengeluaran with audit trail
    const result = await pengeluaranRepo.create({
      ...body,
      createdBy: userId,
    })

    // Log financial access for audit
    await FinanceAuthService.logFinancialAccess(
      request,
      authResult.user,
      'CREATE',
      'PENGELUARAN',
      {
        id: result.id,
        jumlah: body.jumlah,
        kategori: body.kategori,
        tipe: body.tipePengeluaran
      }
    )

    return NextResponse.json(
      { success: true, id: result.id, message: 'Pengeluaran created successfully' },
      { status: 201 }
    )

  } catch (error: any) {
    console.error('Error creating pengeluaran:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}