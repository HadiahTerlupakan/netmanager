import { NextRequest, NextResponse } from 'next/server'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'
import { Status } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getPelangganService } from '@/modules/pelanggan'
import type { FilterOptions } from '@/modules/pelanggan'
import { logger } from '@/lib/logger'
import { apiSuccess, apiPaginated } from '@/lib/api-response'

/**
 * @swagger
 * /api/pelanggan-ppp:
 *   get:
 *     summary: Get all PPPoE customers
 *     description: Retrieve a list of all PPPoE customers with their package and bandwidth details
 *     tags: [Customer Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AKTIF, NONAKTIF, ISOLIR]
 *         description: Filter by customer status
 *     responses:
 *       200:
 *         description: Successfully retrieved customer list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/Error'
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("pelanggan:read"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as Status | null
    const siteIdParam = searchParams.get('siteId')
    const search = searchParams.get('search')

    const isSiteRestricted =
      (await hasPermission('pelanggan:site_only')) &&
      session.user.role !== 'SUPER_ADMIN'

    const filter: FilterOptions = {}
    if (status) filter.status = status
    if (search) filter.search = search

    if (isSiteRestricted) {
      const userSiteId = (session.user as { siteId?: string }).siteId
      if (!userSiteId) {
        return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
      }
      filter.siteId = userSiteId
    } else if (siteIdParam) {
      filter.siteId = siteIdParam
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const pelangganService = getPelangganService()
    const { data: pelanggans, total } = await pelangganService.getAllPelangganPaginated(filter, page, limit)

    return apiPaginated(pelanggans, { page, limit, total })
  } catch (error) {
    console.error('Error fetching pelanggans:', error)
    return NextResponse.json(
      { error: (error as Error)?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * @swagger
 * /api/pelanggan-ppp:
 *   post:
 *     summary: Create a new PPPoE customer
 *     description: Create a new PPPoE customer with service package and account details
 *     tags: [Customer Management]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Successfully created customer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: ID or Username already exists
 *       500:
 *         $ref: '#/components/responses/Error'
 */
import { createPelangganSchema } from '@/lib/validations/pelanggan'
import { validateFileSignature } from '@/lib/utils/file-validation'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("pelanggan:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData = await req.formData()
    const rawData = Object.fromEntries(formData.entries())

    // Convert checkbox/boolean fields explicitly for Zod
    // (Note: The schema handles string 'true'/'on', but helpful to be explicit)

    // Parse with Zod
    const validationResult = createPelangganSchema.safeParse(rawData)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validasi Gagal', details: validationResult.error.flatten() },
        { status: 400 }
      )
    }

    const data = validationResult.data

    const isSiteRestricted =
      (await hasPermission('pelanggan:site_only')) &&
      session.user.role !== 'SUPER_ADMIN'

    // Force siteId for restricted users
    if (isSiteRestricted) {
      const userSiteId = (session.user as { siteId?: string }).siteId
      if (!userSiteId) {
        return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
      }
      data.siteId = userSiteId
    }

    // Handle file uploads with strict validation
    const fileKTP = formData.get('fileKTP') as File | null
    const fileRumahSekitar = formData.get('fileRumahSekitar') as File | null
    const fileBAST = formData.get('fileBAST') as File | null

    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', data.idPelanggan.trim())
    let fileKTPPath: string | null = null
    let fileRumahSekitarPath: string | null = null
    let fileBASTPath: string | null = null

    const ALLOWED_TYPES: ('jpg' | 'png' | 'pdf')[] = ['jpg', 'png', 'pdf']

    try {
      if (fileKTP && fileKTP.size > 0) {
        const isValid = await validateFileSignature(fileKTP, ALLOWED_TYPES)
        if (!isValid) {
            return NextResponse.json({ error: 'File KTP tidak valid (harus JPG, PNG, atau PDF)' }, { status: 400 })
        }
        
        if (isImageFile(fileKTP)) {
          fileKTPPath = await convertAndSaveImage(fileKTP, pelangganUploadDir, 'ktp')
        } else {
          const ext = path.extname(fileKTP.name) || '.pdf'
          fileKTPPath = await saveFile(fileKTP, pelangganUploadDir, `ktp${ext}`)
        }
      }

      if (fileRumahSekitar && fileRumahSekitar.size > 0) {
         const isValid = await validateFileSignature(fileRumahSekitar, ALLOWED_TYPES)
        if (!isValid) {
            return NextResponse.json({ error: 'File Rumah tidak valid (harus JPG, PNG, atau PDF)' }, { status: 400 })
        }

        if (isImageFile(fileRumahSekitar)) {
          fileRumahSekitarPath = await convertAndSaveImage(fileRumahSekitar, pelangganUploadDir, 'rumah')
        } else {
          const ext = path.extname(fileRumahSekitar.name) || '.pdf'
          fileRumahSekitarPath = await saveFile(fileRumahSekitar, pelangganUploadDir, `rumah${ext}`)
        }
      }

      if (fileBAST && fileBAST.size > 0) {
         const isValid = await validateFileSignature(fileBAST, ALLOWED_TYPES)
        if (!isValid) {
            return NextResponse.json({ error: 'File BAST tidak valid (harus JPG, PNG, atau PDF)' }, { status: 400 })
        }

        if (isImageFile(fileBAST)) {
          fileBASTPath = await convertAndSaveImage(fileBAST, pelangganUploadDir, 'bast')
        } else {
          const ext = path.extname(fileBAST.name) || '.pdf'
          fileBASTPath = await saveFile(fileBAST, pelangganUploadDir, `bast${ext}`)
        }
      }
    } catch (fileError) {
      console.error('Error saving files:', fileError)
      return NextResponse.json({ error: 'Gagal memproses upload file' }, { status: 500 })
    }

    // Create pelanggan using service
    const pelangganService = getPelangganService()
    const pelanggan = await pelangganService.createPelanggan({
      ...data,
      fileKTP: fileKTPPath,
      fileRumahSekitar: fileRumahSekitarPath,
      fileBAST: fileBASTPath,
    } as Parameters<ReturnType<typeof getPelangganService>['createPelanggan']>[0])

    // Revalidate cache
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath('/api/pelanggan-ppp')

    // System Log
    try {
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Pelanggan',
        userId: session.user.id ?? 'unknown',
        details: { id: pelanggan.id, nama: pelanggan.nama, username: pelanggan.username }
      })
    } catch (logError) {
      console.error('Failed to log activity:', logError)
    }

    return apiSuccess(pelanggan, { status: 201 })
  } catch (error) {
    console.error('Error creating pelanggan:', error)
    const err = error as { message: string; code?: string }

    // Handle specific errors from service
    if (err.message.includes('sudah digunakan')) {
       return NextResponse.json({ error: err.message }, { status: 409 })
    }

    if (err.message === 'Harga Paket tidak ditemukan') {
      return NextResponse.json({ error: err.message }, { status: 404 })
    }

    // Handle Prisma unique constraint error
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'ID Pelanggan atau Username sudah digunakan.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
