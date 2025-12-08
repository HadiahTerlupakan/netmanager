import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function requireAdmin() {
  const session: any = await getServerSession(authConfig as any)
  if (!session || session?.user?.role !== 'ADMIN') {
    return null
  }
  return session
}

/**
 * GET /api/inventory/barang
 * Get all items with optional filters
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/barang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const gudangId = searchParams.get('gudangId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    try {
      const dbStart = Date.now()

      // Build where clause
      const where: any = {}

      if (search) {
        where.OR = [
          { kode: { contains: search, mode: 'insensitive' } },
          { nama: { contains: search, mode: 'insensitive' } }
        ]
      }

      const [barangs, total] = await Promise.all([
        prisma.barang.findMany({
          where,
          orderBy: {
            createdAt: 'desc'
          },
          skip: offset,
          take: limit,
          include: {
            // Get ALL stocks for total calculation
            stok: {
              include: {
                gudang: {
                  select: {
                    id: true,
                    kode: true,
                    nama: true
                  }
                }
              }
            }
          }
        }),
        prisma.barang.count({ where })
      ])

      // Calculate total stock per item and filter by gudang if needed
      const barangsWithStock = barangs.map(barang => {
        let totalStock = 0
        let stockPerGudang: any[] = []

        if (barang.stok) {
          // Calculate TOTAL stock from ALL warehouses
          totalStock = barang.stok.reduce((sum, stock) => sum + stock.stok, 0)

          // Filter stocks by gudangId if specified, otherwise show all
          const filteredStocks = gudangId
            ? barang.stok.filter(stock => stock.gudangId === gudangId)
            : barang.stok

          stockPerGudang = filteredStocks.map(stock => ({
            gudangId: stock.gudangId,
            gudangKode: stock.gudang.kode,
            gudangNama: stock.gudang.nama,
            stok: stock.stok
          }))
        }

        return {
          ...barang,
          totalStock,
          stockPerGudang
        }
      })

      logger.dbOperation('findMany', 'Barang+BarangGudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/barang', 200, Date.now() - startTime, {
        userId: session.user.id,
        barangCount: barangsWithStock.length,
        page,
        limit,
        total,
        gudangId,
        search,
      })

      return NextResponse.json({
        barangs: barangsWithStock,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching barangs', error, {
      path: '/api/inventory/barang',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data barang' },
      { status: 500 }
    )
  }
}

/**
 * Generate automatic barang code
 */
async function generateBarangCode(): Promise<string> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `BRG${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`
}

/**
 * POST /api/inventory/barang
 * Create new item
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/barang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { nama, satuan } = body

    // Validation
    if (!nama || !satuan) {
      return NextResponse.json(
        { error: 'Nama dan satuan barang harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Generate unique kode
      let kode: string
      let attempts = 0
      const maxAttempts = 10

      do {
        kode = await generateBarangCode()
        const existingBarang = await prisma.barang.findUnique({
          where: { kode }
        })

        if (!existingBarang) break
        attempts++
      } while (attempts < maxAttempts)

      if (attempts >= maxAttempts) {
        throw new Error('Gagal generate kode unik')
      }

      const barang = await prisma.barang.create({
        data: {
          kode,
          nama,
          satuan
        }
      })

      logger.dbOperation('create', 'Barang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/barang', 201, Date.now() - startTime, {
        userId: session.user.id,
        barangId: barang.id,
        kode: barang.kode,
      })

      return NextResponse.json({ barang }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating barang', error, {
      path: '/api/inventory/barang',
      method: 'POST',
    })
    return NextResponse.json(
      { error: error.message || 'Gagal membuat barang' },
      { status: 500 }
    )
  }
}