import { NextResponse } from 'next/server'
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
 * Generate automatic warehouse code
 */
async function generateGudangCode(): Promise<string> {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
  return `GD${timestamp.toString().slice(-6)}${random.toString().padStart(3, '0')}`
}

/**
 * GET /api/inventory/gudang
 * Get all warehouses
 */
export async function GET() {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to GET /api/inventory/gudang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const dbStart = Date.now()

      const gudangs = await prisma.gudang.findMany({
        where: {
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      logger.dbOperation('findMany', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('GET', '/api/inventory/gudang', 200, Date.now() - startTime, {
        userId: session.user.id,
        gudangCount: gudangs.length,
      })

      return NextResponse.json({ gudangs })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error fetching gudangs', error, {
      path: '/api/inventory/gudang',
      method: 'GET',
    })
    return NextResponse.json(
      { error: 'Gagal memuat data gudang' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/gudang
 * Create new warehouse
 */
export async function POST(req: Request) {
  const startTime = Date.now()
  try {
    const session = await requireAdmin()
    if (!session) {
      logger.warn('Unauthorized access attempt to POST /api/inventory/gudang')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { nama, lokasi, isActive } = body

    // Validation
    if (!nama) {
      return NextResponse.json(
        { error: 'Nama gudang harus diisi' },
        { status: 400 }
      )
    }

    try {
      const dbStart = Date.now()

      // Generate automatic gudang code
      const kode = await generateGudangCode()

      const gudang = await prisma.gudang.create({
        data: {
          kode,
          nama,
          lokasi,
          isActive: isActive ?? true
        }
      })

      logger.dbOperation('create', 'Gudang', Date.now() - dbStart)

      logger.apiRequest('POST', '/api/inventory/gudang', 201, Date.now() - startTime, {
        userId: session.user.id,
        gudangId: gudang.id,
        kode: gudang.kode,
      })

      return NextResponse.json({ gudang }, { status: 201 })
    } finally {
      // do not disconnect shared prisma client
    }
  } catch (error: any) {
    logger.error('Error creating gudang', error, {
      path: '/api/inventory/gudang',
      method: 'POST',
    })
    return NextResponse.json(
      { error: 'Gagal membuat gudang' },
      { status: 500 }
    )
  }
}