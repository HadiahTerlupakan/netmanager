import { prisma } from '@/modules/database'
import { revalidatePath } from 'next/cache'
import { PelangganAdminMutationService, PelangganAdminQueryService } from '@/modules/pelanggan'
import { Status, TipePelanggan } from '@prisma/client'
import { apiSuccess, ApiErrors, createHandler, apiError } from '@/lib/api'
import { canAccessSite } from '@/modules/roles'

const pelangganAdminQueryService = new PelangganAdminQueryService()
const pelangganAdminMutationService = new PelangganAdminMutationService()

const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'on', 'yes'])

const parseBooleanFlag = (value: FormDataEntryValue | null, defaultValue = false): boolean => {
  if (value === null) return defaultValue
  if (typeof value === 'string') return BOOLEAN_TRUE_VALUES.has(value.toLowerCase())
  return defaultValue
}

const parseEnumValue = <T extends string>(value: string | null, enumObject: Record<string, T>): T | null => {
  if (!value) return null
  const normalized = value.toUpperCase()
  return (Object.values(enumObject) as string[]).find(v => v.toUpperCase() === normalized) as T ?? null
}

const sanitizePelangganResponse = <T extends { password?: string | null; passwordHash?: string | null }>(pelanggan: T) => {
  const { password: _password, passwordHash: _passwordHash, ...safePelanggan } = pelanggan
  return safePelanggan
}

const getTenantScopedWhereById = (
  session: { user: { tenantId?: string | null; isSuperAdmin?: boolean | null; role?: string | null } },
  id: string
) => {
  const tenantId = session.user.tenantId ?? null
  const isSuperAdmin = Boolean(session.user.isSuperAdmin || session.user.role === 'SUPER_ADMIN')

  if (!tenantId && !isSuperAdmin) {
    return { where: null, error: ApiErrors.forbidden('Akses ditolak: tenant tidak teridentifikasi') }
  }

  return {
    where: tenantId ? { id, tenantId } : { id },
    error: null as ReturnType<typeof ApiErrors.forbidden> | null,
  }
}

const canAccessPelangganBySite = (
  session: { user: { role?: string | null } },
  siteId: string | null | undefined
) => {
  if (!session.user.role || session.user.role === 'SUPER_ADMIN') return true
  return canAccessSite(session as Parameters<typeof canAccessSite>[0], 'pelanggan', siteId)
}

/**
 * GET /api/pelanggan-ppp/{id}
 * Support for Read-Audit and Admin/Customer Auth.
 */
export const GET = createHandler({ auth: true }, async (_req, ctx) => {
  const { id } = ctx.params
  const session = ctx.session!

  if (session.user.role === 'CUSTOMER' && session.user.id !== id) {
    return ApiErrors.forbidden('Anda tidak diperbolehkan melihat data pelanggan lain')
  }

  const tenantScope = getTenantScopedWhereById(session as Parameters<typeof getTenantScopedWhereById>[0], id)
  if (tenantScope.error) return tenantScope.error

  const result = await pelangganAdminQueryService.getPppDetail(id, session.user.tenantId ?? null)
  if (!result) return ApiErrors.notFound('Pelanggan')

  const { pelanggan, technicalInfo } = result

  if (!canAccessPelangganBySite(session as Parameters<typeof canAccessPelangganBySite>[0], pelanggan.siteId)) {
    return ApiErrors.forbidden('Anda tidak memiliki akses ke pelanggan di site ini')
  }

  return apiSuccess({
    ...sanitizePelangganResponse(pelanggan),
    technicalInfo,
  })
})

/**
 * PUT /api/pelanggan-ppp/{id}
 */
export const PUT = createHandler({ auth: true, permissions: ['pelanggan:update'] }, async (req, ctx) => {
  const { id } = ctx.params
  const session = ctx.session!

  const tenantScope = getTenantScopedWhereById(session as Parameters<typeof getTenantScopedWhereById>[0], id)
  if (tenantScope.error) return tenantScope.error

  const existingPelanggan = await prisma.pelanggan.findFirst({ where: tenantScope.where! })
  if (!existingPelanggan) return ApiErrors.notFound('Pelanggan')

  if (!canAccessPelangganBySite(session as Parameters<typeof canAccessPelangganBySite>[0], existingPelanggan.siteId)) {
    return ApiErrors.forbidden('Akses ditolak')
  }

  const formData = await req.formData()
  const idPelanggan = formData.get('idPelanggan') as string
  const nama = formData.get('nama') as string
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const hargaPaketId = formData.get('hargaPaketId') as string
  const tipe = formData.get('tipe') as string
  const tanggalAktif = formData.get('tanggalAktif') as string
  const jatuhTempo = formData.get('jatuhTempo') as string
  const status = formData.get('status') as string
  const autoIsolir = parseBooleanFlag(formData.get('autoIsolir'), true)
  const email = formData.get('email') as string | null
  const siteIdRaw = formData.get('siteId') as string | null
  const invoiceAction = formData.get('invoiceAction') as string | null
  const passwordLogin = formData.get('passwordLogin') as string | null

  if (!idPelanggan || !nama || !username || !password || !hargaPaketId || !tanggalAktif || !jatuhTempo) {
    return apiError('Semua field wajib harus diisi', 'VALIDATION_ERROR', { status: 400 })
  }

  const tanggalAktifDate = new Date(tanggalAktif)
  if (Number.isNaN(tanggalAktifDate.getTime())) {
    return apiError('Tanggal aktif tidak valid', 'VALIDATION_ERROR', { status: 400 })
  }

  const jatuhTempoDate = new Date(jatuhTempo)
  if (Number.isNaN(jatuhTempoDate.getTime())) {
    return apiError('Tanggal jatuh tempo tidak valid', 'VALIDATION_ERROR', { status: 400 })
  }

  const parsedSiteId = siteIdRaw === '' ? null : siteIdRaw
  if (!canAccessPelangganBySite(session as Parameters<typeof canAccessPelangganBySite>[0], parsedSiteId)) {
    return ApiErrors.forbidden('Akses ditolak')
  }

  const pelanggan = await pelangganAdminMutationService.updatePppById({
    id,
    existingStatus: existingPelanggan.status,
    data: {
      idPelanggan,
      nama,
      username,
      password,
      hargaPaketId,
      tipe: parseEnumValue(tipe, TipePelanggan),
      tanggalAktif: tanggalAktifDate,
      jatuhTempo: jatuhTempoDate,
      status: parseEnumValue(status, Status),
      autoIsolir,
      email,
      siteId: parsedSiteId,
      invoiceAction,
      passwordLogin,
    },
  })

  revalidatePath('/admin/pelanggan/ppp')
  ctx.validated = { id: pelanggan.id, action: 'UPDATE_PII' }
  return apiSuccess(sanitizePelangganResponse(pelanggan))
})

/**
 * DELETE /api/pelanggan-ppp/{id}
 */
export const DELETE = createHandler({ auth: true, permissions: ['pelanggan:delete'] }, async (_req, ctx) => {
  const { id } = ctx.params
  const session = ctx.session!

  const tenantScope = getTenantScopedWhereById(session as Parameters<typeof getTenantScopedWhereById>[0], id)
  if (tenantScope.error) return tenantScope.error

  const pelanggan = await prisma.pelanggan.findFirst({ where: tenantScope.where! })
  if (!pelanggan) return ApiErrors.notFound('Pelanggan')

  if (!canAccessPelangganBySite(session as Parameters<typeof canAccessPelangganBySite>[0], pelanggan.siteId)) {
    return ApiErrors.forbidden('Akses ditolak')
  }

  await pelangganAdminMutationService.deletePppById(id, pelanggan.username)

  revalidatePath('/admin/pelanggan/ppp')
  ctx.validated = { id, nama: pelanggan.nama, username: pelanggan.username }
  return apiSuccess({ message: 'Pelanggan berhasil dihapus' })
})
