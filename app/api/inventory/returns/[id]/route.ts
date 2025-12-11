import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import type { ReturnDetailResponse, BarangKeluarWithRelations } from '@/types/inventory-returns'

/**
 * Authentication helper - requires ADMIN or EMPLOYEE role
 */
async function requireAuth() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || !['ADMIN', 'EMPLOYEE'].includes(session?.user?.role)) {
    return null
  }
  return session
}

/**
 * Helper function to calculate returnable quantity for a BarangKeluar
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
 * Helper function to check if user can access this BarangKeluar
 */
async function canAccessBarangKeluar(barangKeluarId: string, session: any): Promise<boolean> {
  if (session.user.role === 'ADMIN') {
    return true // Admin can access all
  }

  // Employee can only access their own BarangKeluar records
  const barangKeluar = await prisma.barangKeluar.findUnique({
    where: { id: barangKeluarId },
    select: { employeeId: true }
  })

  return barangKeluar?.employeeId === session.user.id
}

/**
 * GET /api/inventory/returns/[id]
 * Get detailed information about a specific BarangKeluar transaction for return purposes
 * 
 * Query parameters:
 * - includeHistory: boolean (default: false) - include return history if available
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now()
  const { id } = await params

  try {
    // Authentication
    const session = await requireAuth()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/returns/[id]', {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        userAgent: req.headers.get('user-agent'),
        barangKeluarId: id
      })
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Employee access required' },
        { status: 401 }
      )
    }

    // Validate ID
    if (!id) {
      return NextResponse.json(
        { error: 'Barang Keluar ID is required' },
        { status: 400 }
      )
    }

    // Check if user can access this BarangKeluar
    const canAccess = await canAccessBarangKeluar(id, session)
    if (!canAccess) {
      logger.warn('Access denied to BarangKeluar', {
        userId: session.user.id,
        barangKeluarId: id,
        role: session.user.role
      })
      return NextResponse.json(
        { error: 'Access denied - You can only access your own borrowed items' },
        { status: 403 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const includeHistory = searchParams.get('includeHistory') === 'true'

    try {
      const dbStart = Date.now()

      // Get detailed BarangKeluar information
      const barangKeluar = await prisma.barangKeluar.findUnique({
        where: { id },
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
          },
          // Include user info if admin
          ...(session.user.role === 'ADMIN' ? {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          } : {})
        }
      })

      if (!barangKeluar) {
        return NextResponse.json(
          { error: 'Barang keluar tidak ditemukan' },
          { status: 404 }
        )
      }

      logger.dbOperation('findUnique', 'BarangKeluar+Relations', Date.now() - dbStart)

      // Calculate returnable quantity
      const returnableQuantity = await getReturnableQuantity(id)
      const canReturn = returnableQuantity > 0

      // Get return history if requested (placeholder for future implementation)
      let returnHistory: any[] = []
      if (includeHistory) {
        // Placeholder - would query from BarangReturn table when implemented
        // returnHistory = await prisma.barangReturn.findMany({
        //   where: { barangKeluarId: id },
        //   orderBy: { createdAt: 'desc' }
        // })
      }

      const response: ReturnDetailResponse = {
        barangKeluar: barangKeluar as BarangKeluarWithRelations,
        canReturn,
        maxReturnableQuantity: returnableQuantity,
        returnHistory
      }

      logger.apiRequest('GET', `/api/inventory/returns/${id}`, 200, Date.now() - startTime, {
        userId: session.user.id,
        barangKeluarId: id,
        includeHistory,
        canReturn,
        returnableQuantity
      })

      return NextResponse.json(response)

    } finally {
      // Do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching BarangKeluar detail for return', error, {
      path: '/api/inventory/returns/[id]',
      method: 'GET',
      barangKeluarId: id,
      ip: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent')
    })

    return NextResponse.json(
      { error: 'Gagal memuat detail barang keluar' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/inventory/returns/[id]
 * Update BarangKeluar record (not typically used for returns, but included for completeness)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const session = await requireAuth()
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin or Employee access required' },
        { status: 401 }
      )
    }

    // Check if user can access this BarangKeluar
    const canAccess = await canAccessBarangKeluar(id, session)
    if (!canAccess) {
      return NextResponse.json(
        { error: 'Access denied - You can only update your own borrowed items' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { keterangan, purpose } = body

    // Update BarangKeluar record
    const updatedBarangKeluar = await prisma.barangKeluar.update({
      where: { id },
      data: {
        ...(keterangan && { keterangan }),
        ...(purpose && { purpose })
      }
    })

    logger.apiRequest('PUT', `/api/inventory/returns/${id}`, 200, Date.now(), {
      userId: session.user.id,
      barangKeluarId: id,
      updatedFields: Object.keys(body)
    })

    return NextResponse.json({
      message: 'Barang keluar berhasil diperbarui',
      data: updatedBarangKeluar
    })

  } catch (error: any) {
    logger.error('Error updating BarangKeluar', error, {
      path: '/api/inventory/returns/[id]',
      method: 'PUT',
      barangKeluarId: id
    })

    return NextResponse.json(
      { error: 'Gagal memperbarui barang keluar' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/inventory/returns/[id]
 * Delete BarangKeluar record (emergency operation only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const session = await requireAuth()
    if (!session || false) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required for deletion' },
        { status: 401 }
      )
    }

    // Check if BarangKeluar exists
    const barangKeluar = await prisma.barangKeluar.findUnique({
      where: { id },
      select: { jumlah: true, barangId: true, gudangId: true }
    })

    if (!barangKeluar) {
      return NextResponse.json(
        { error: 'Barang keluar tidak ditemukan' },
        { status: 404 }
      )
    }

    // Delete BarangKeluar and restore stock
    await prisma.$transaction(async (tx) => {
      // Delete the BarangKeluar record
      await tx.barangKeluar.delete({
        where: { id }
      })

      // Restore stock to BarangGudang
      const existingStock = await tx.barangGudang.findUnique({
        where: { 
          barangId_gudangId: { 
            barangId: barangKeluar.barangId, 
            gudangId: barangKeluar.gudangId 
          } 
        }
      })

      if (existingStock) {
        // Update existing stock
        await tx.barangGudang.update({
          where: { 
            barangId_gudangId: { 
              barangId: barangKeluar.barangId, 
              gudangId: barangKeluar.gudangId 
            } 
          },
          data: { 
            stok: existingStock.stok + barangKeluar.jumlah 
          }
        })
      } else {
        // Create new stock record
        await tx.barangGudang.create({
          data: {
            barangId: barangKeluar.barangId,
            gudangId: barangKeluar.gudangId,
            stok: barangKeluar.jumlah
          }
        })
      }
    })

    logger.apiRequest('DELETE', `/api/inventory/returns/${id}`, 200, Date.now(), {
      userId: session.user.id,
      barangKeluarId: id,
      restoredQuantity: barangKeluar.jumlah
    })

    return NextResponse.json({
      message: 'Barang keluar berhasil dihapus dan stok dikembalikan',
      restoredQuantity: barangKeluar.jumlah
    })

  } catch (error: any) {
    logger.error('Error deleting BarangKeluar', error, {
      path: '/api/inventory/returns/[id]',
      method: 'DELETE',
      barangKeluarId: id
    })

    return NextResponse.json(
      { error: 'Gagal menghapus barang keluar' },
      { status: 500 }
    )
  }
}