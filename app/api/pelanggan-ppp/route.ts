import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'
import { Status, Prisma } from '@prisma/client'
import { getPelangganService } from '@/modules/pelanggan'
import type { FilterOptions } from '@/modules/pelanggan'
import { checkSiteRestriction } from '@/modules/roles'
import { apiSuccess, apiPaginated, ApiErrors, createHandler, apiError } from '@/lib/api'
import { createPelangganSchema } from '@/lib/validations/pelanggan'
import { validateFileSignature } from '@/lib/utils/file-validation'

const sanitizePelangganResponse = <T extends { password?: string | null; passwordHash?: string | null }>(pelanggan: T) => {
  const { password: _password, passwordHash: _passwordHash, ...safePelanggan } = pelanggan
  return safePelanggan
}

/**
 * GET /api/pelanggan-ppp
 * Get all PPPoE customers with Read-Audit support.
 */
export const GET = createHandler({ 
    auth: true,
    permissions: ['pelanggan:read']
}, async (req, ctx) => {
    const session = ctx.session!;
    const { searchParams } = req.nextUrl
    const status = searchParams.get('status') as Status | null
    const siteIdParam = searchParams.get('siteId')
    const search = searchParams.get('search')

    const { isRestricted, siteIds } = checkSiteRestriction(session as unknown as Parameters<typeof checkSiteRestriction>[0], 'pelanggan')

    const filter: FilterOptions & { siteIds?: string[] } = {}
    if (status) filter.status = status
    if (search) filter.search = search

    if (isRestricted) {
      if (siteIds.length === 0) return ApiErrors.forbidden('User tidak memiliki akses site')
      filter.siteId = { in: siteIds } as Prisma.StringNullableFilter
    } else if (siteIdParam) {
      filter.siteId = siteIdParam
    }

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')

    const pelangganService = getPelangganService()
    const { data: pelanggans, total } = await pelangganService.getAllPelangganPaginated(filter, page, limit)
    const safePelanggans = pelanggans.map(sanitizePelangganResponse)

    return apiPaginated(safePelanggans, { page, limit, total })
})

/**
 * POST /api/pelanggan-ppp
 * Create a new PPPoE customer with auto-audit.
 */
export const POST = createHandler({ 
    auth: true,
    permissions: ['pelanggan:create']
}, async (req, ctx) => {
    const session = ctx.session!;
    const formData = await req.formData()
    const rawData = Object.fromEntries(formData.entries())
    if (rawData.siteId === '') rawData.siteId = null;
    if (rawData.odpId === '') rawData.odpId = null;

    const validationResult = createPelangganSchema.safeParse(rawData)
    if (!validationResult.success) {
      const details = validationResult.error.flatten();
      const firstError = Object.values(details.fieldErrors)[0]?.[0] || 'Periksa kembali input Anda';
      return apiError(`Validasi Gagal: ${firstError}`, 'VALIDATION_ERROR', { status: 400, details });
    }

    const data = validationResult.data
    const { isRestricted, primarySiteId } = checkSiteRestriction(session as unknown as Parameters<typeof checkSiteRestriction>[0], 'pelanggan')

    if (isRestricted) {
      if (!primarySiteId) return ApiErrors.forbidden('User tidak memiliki akses site')
      data.siteId = primarySiteId
    }

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
        if (!await validateFileSignature(fileKTP, ALLOWED_TYPES)) return apiError('File KTP tidak valid', 'VALIDATION_ERROR', { status: 400 })
        fileKTPPath = isImageFile(fileKTP) ? await convertAndSaveImage(fileKTP, pelangganUploadDir, 'ktp') : await saveFile(fileKTP, pelangganUploadDir, `ktp${path.extname(fileKTP.name) || '.pdf'}`)
      }
      if (fileRumahSekitar && fileRumahSekitar.size > 0) {
        if (!await validateFileSignature(fileRumahSekitar, ALLOWED_TYPES)) return apiError('File Rumah tidak valid', 'VALIDATION_ERROR', { status: 400 })
        fileRumahSekitarPath = isImageFile(fileRumahSekitar) ? await convertAndSaveImage(fileRumahSekitar, pelangganUploadDir, 'rumah') : await saveFile(fileRumahSekitar, pelangganUploadDir, `rumah${path.extname(fileRumahSekitar.name) || '.pdf'}`)
      }
      if (fileBAST && fileBAST.size > 0) {
        if (!await validateFileSignature(fileBAST, ALLOWED_TYPES)) return apiError('File BAST tidak valid', 'VALIDATION_ERROR', { status: 400 })
        fileBASTPath = isImageFile(fileBAST) ? await convertAndSaveImage(fileBAST, pelangganUploadDir, 'bast') : await saveFile(fileBAST, pelangganUploadDir, `bast${path.extname(fileBAST.name) || '.pdf'}`)
      }
    } catch (e) {
      console.error('Error saving files:', e)
      return ApiErrors.internalError('Gagal memproses upload file')
    }

    const pelangganService = getPelangganService()
    const pelanggan = await pelangganService.createPelanggan({ ...data, fileKTP: fileKTPPath, fileRumahSekitar: fileRumahSekitarPath, fileBAST: fileBASTPath } as Parameters<typeof pelangganService.createPelanggan>[0])

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath('/api/pelanggan-ppp')

    ctx.validated = { id: pelanggan.id, idPelanggan: pelanggan.idPelanggan, nama: pelanggan.nama, username: pelanggan.username } // Sync for audit log
    return apiSuccess(sanitizePelangganResponse(pelanggan), { status: 201 })
})
