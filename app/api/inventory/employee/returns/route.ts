import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { EmployeeReturnsResponse, EmployeeReturnItem, EmployeeReturnsQuery } from '@/types/inventory-returns'

/**
 * Helper function to calculate returnable quantity for a BarangKeluar
 * This calculates how much of the original quantity can still be returned
 */
async function getReturnableQuantity(barangKeluarId: string): Promise<number> {
  // Get original BarangKeluar record
  const barangKeluar = await prisma.barangKeluar.findUnique({
    where: { id: barangKeluarId },
    select: { jumlah: true }
  })

  if (!barangKeluar) {
    return 0
  }

  // Calculate total quantity already returned for this BarangKeluar
  // Note: This assumes we have a BarangReturn table, for now we'll return the full quantity
  // In a real implementation, you would query the returns table
  const totalReturned = 0 // Placeholder - would be calculated from returns table

  return Math.max(0, barangKeluar.jumlah - totalReturned)
}

/**
 * GET /api/inventory/employee/returns
 * Get all items borrowed by the current employee that can be returned
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - search: string (searches in barang name or kode)
 * - barangId: string (filter by specific barang)
 * - gudangId: string (filter by specific gudang)
 * - kondisi: string (filter by condition: BARU, BEKAS, RUSAK)
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    // Authentication - only ADMIN can access this endpoint
    const session = await requireAdmin(req)
    if (session instanceof NextResponse) {
      return session // Return error response if authentication fails
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit
    const search = searchParams.get('search') || ''
    const barangId = searchParams.get('barangId')
    const gudangId = searchParams.get('gudangId')
    const kondisi = searchParams.get('kondisi')

    // Validate pagination parameters
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Build where clause for filtering
      const where: any = {
        isHilang: false, // Exclude lost items
      }

      // For admin, allow optional employeeId filter from query params
      const filterEmployeeId = searchParams.get('employeeId')
      if (filterEmployeeId) {
        where.employeeId = filterEmployeeId
      }

      // Add optional filters
      if (barangId) where.barangId = barangId
      if (gudangId) where.gudangId = gudangId
      if (kondisi) where.kondisi = kondisi

      // Add search condition
      if (search) {
        where.OR = [
          { barang: { nama: { contains: search, mode: 'insensitive' } } },
          { barang: { kode: { contains: search, mode: 'insensitive' } } },
          { keterangan: { contains: search, mode: 'insensitive' } },
          { purpose: { contains: search, mode: 'insensitive' } }
        ]
      }

      // Get barang keluar records for employee
      const [barangKeluarList, total] = await Promise.all([
        prisma.barangKeluar.findMany({
          where,
          include: {
            barang: {
              select: {
                id: true,
                kode: true,
                nama: true,
                satuan: true
              }
            },
            gudang: {
              select: {
                id: true,
                kode: true,
                nama: true
              }
            }
          },
          orderBy: {
            tanggal: 'desc'
          },
          skip: offset,
          take: limit
        }),
        prisma.barangKeluar.count({ where })
      ])

      logger.dbOperation('findMany', 'BarangKeluar+Relations', Date.now() - dbStart)

      // Calculate returnable quantity for each item
      const returnItems: (EmployeeReturnItem & { returnableQuantity: number; canReturn: boolean })[] = await Promise.all(
        barangKeluarList.map(async (item) => {
          const returnableQty = await getReturnableQuantity(item.id)
          
          return {
            id: item.id,
            barang: item.barang,
            gudang: item.gudang,
            jumlah: item.jumlah,
            kondisi: item.kondisi,
            tanggal: item.tanggal,
            keterangan: item.keterangan || undefined,
            purpose: item.purpose || undefined,
            isHilang: item.isHilang,
            fotoBukti: item.fotoBukti,
            // Add computed property for frontend
            returnableQuantity: returnableQty,
            canReturn: returnableQty > 0
          }
        })
      )

      // Filter out items that cannot be returned (returnable quantity is 0)
      const returnableItems = returnItems.filter(item => item.returnableQuantity > 0)

      logger.apiRequest('GET', '/api/inventory/employee/returns', 200, Date.now() - startTime, {
        userId: session.user.id,
        count: returnableItems.length,
        page,
        limit,
        total,
        search,
        barangId,
        gudangId,
        kondisi
      })

      const response: EmployeeReturnsResponse = {
        returns: returnableItems,
        pagination: {
          page,
          limit,
          total: returnableItems.length, // Update total to reflect filtered results
          totalPages: Math.ceil(returnableItems.length / limit)
        }
      }

      return NextResponse.json(response)

    } finally {
      // Do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching employee returns', error, {
      path: '/api/inventory/employee/returns',
      method: 'GET',
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent')
    })

    return NextResponse.json(
      { error: 'Gagal memuat data barang dipinjam' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/employee/returns
 * This endpoint is not implemented for employee returns
 * Employees should use POST /api/inventory/returns instead
 */
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST /api/inventory/returns for creating returns.' },
    { status: 405 }
  )
}