import { NextRequest, NextResponse } from 'next/server'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'
import { DiscountType, DurasiUnit, Status, TipePelanggan } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { getPelangganService } from '@/modules/pelanggan'
import type { FilterOptions } from '@/modules/pelanggan'
import { logger } from '@/lib/logger'

const BOOLEAN_TRUE_VALUES = new Set(['true', '1', 'on', 'yes'])

const parseBooleanFlag = (
  value: FormDataEntryValue | null,
  defaultValue = false
): boolean => {
  if (value === null) {
    return defaultValue
  }

  if (typeof value === 'string') {
    return BOOLEAN_TRUE_VALUES.has(value.toLowerCase())
  }

  return defaultValue
}

const parseEnumValue = <T extends string>(
  value: string | null,
  enumObject: Record<string, T>
): T | null => {
  if (!value) {
    return null
  }

  const normalized = value.toUpperCase()
  const matched = (Object.values(enumObject) as string[]).find(
    (enumValue) => enumValue.toUpperCase() === normalized
  )

  return (matched as T | undefined) ?? null
}

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

    const isSiteRestricted =
      (await hasPermission('pelanggan:site_only')) &&
      session.user.role !== 'SUPER_ADMIN'

    const filter: FilterOptions = {}
    if (status) filter.status = status

    if (isSiteRestricted) {
      const userSiteId = (session.user as any).siteId
      if (!userSiteId) {
        return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
      }
      filter.siteId = userSiteId
    } else if (siteIdParam) {
      filter.siteId = siteIdParam
    }

    const pelangganService = getPelangganService()
    const pelanggans = await pelangganService.getAllPelanggan(filter)

    return NextResponse.json(pelanggans, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error fetching pelanggans:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
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
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(await hasPermission("pelanggan:create"))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const formData: any = await req.formData()

    // Extract form fields
    const idPelanggan = formData.get('idPelanggan') as string
    const nama = formData.get('nama') as string
    const username = formData.get('username') as string
    const password = formData.get('password') as string
    const passwordLogin = formData.get('passwordLogin') as string
    const hargaPaketId = formData.get('hargaPaketId') as string
    const tipe = formData.get('tipe') as string
    const tanggalAktif = formData.get('tanggalAktif') as string
    const jatuhTempo = formData.get('jatuhTempo') as string
    const status = formData.get('status') as string
    const autoIsolir = parseBooleanFlag(formData.get('autoIsolir'), true)
    let siteId = formData.get('siteId') as string | null

    const isSiteRestricted =
      (await hasPermission('pelanggan:site_only')) &&
      session.user.role !== 'SUPER_ADMIN'

    // Force siteId for restricted users
    if (isSiteRestricted) {
      const userSiteId = (session.user as any).siteId
      if (!userSiteId) {
        return NextResponse.json({ error: 'User tidak memiliki akses site' }, { status: 403 })
      }
      siteId = userSiteId
    }

    // Validate required fields
    if (!idPelanggan || !nama || !username || !password || !passwordLogin || !hargaPaketId || !tanggalAktif || !jatuhTempo) {
      return NextResponse.json(
        { error: 'Semua field wajib harus diisi' },
        { status: 400 }
      )
    }

    // Parse optional fields
    const alamat = formData.get('alamat') as string | null
    const provinsi = formData.get('provinsi') as string | null
    const kabupatenKota = formData.get('kabupatenKota') as string | null
    const kelurahanDesa = formData.get('kelurahanDesa') as string | null
    const kecamatan = formData.get('kecamatan') as string | null
    const noTelp = formData.get('noTelp') as string | null
    const email = formData.get('email') as string | null
    const latitudeRaw = formData.get('latitude') as string | null
    const longitudeRaw = formData.get('longitude') as string | null
    const latitude = latitudeRaw ? parseFloat(latitudeRaw) : null
    const longitude = longitudeRaw ? parseFloat(longitudeRaw) : null
    const jenisDokumen = formData.get('jenisDokumen') as string | null
    const noDokumen = formData.get('noDokumen') as string | null
    const catatan = formData.get('catatan') as string | null
    const usePPN = parseBooleanFlag(formData.get('usePPN'), true)
    const useDiscount = parseBooleanFlag(formData.get('useDiscount'))
    const useProrate = parseBooleanFlag(formData.get('useProrate'))
    const discountType = formData.get('discountType') as string | null
    const discountValueRaw = formData.get('discountValue') as string | null
    const discountValue = discountValueRaw ? parseFloat(discountValueRaw) : null
    const discountDurationRaw = formData.get('discountDuration') as string | null
    const discountDuration = discountDurationRaw ? parseInt(discountDurationRaw) : null
    const discountDurationUnit = formData.get('discountDurationUnit') as string | null
    const biayaInstalasiRaw = formData.get('biayaInstalasi') as string | null
    const biayaInstalasi = biayaInstalasiRaw ? parseInt(biayaInstalasiRaw) : null
    const biayaInstalasiIsRecurring = parseBooleanFlag(formData.get('biayaInstalasiIsRecurring'))
    const useDiskonBiayaInstalasi = parseBooleanFlag(formData.get('useDiskonBiayaInstalasi'))
    const biayaInstalasiDiskonRaw = formData.get('biayaInstalasiDiskon') as string | null
    const biayaInstalasiDiskon = biayaInstalasiDiskonRaw ? parseFloat(biayaInstalasiDiskonRaw) : null
    const biayaSewaPerangkatRaw = formData.get('biayaSewaPerangkat') as string | null
    const biayaSewaPerangkat = biayaSewaPerangkatRaw ? parseInt(biayaSewaPerangkatRaw) : null
    const biayaSewaPerangkatIsRecurring = parseBooleanFlag(formData.get('biayaSewaPerangkatIsRecurring'), true)
    const biayaSewaPerangkatDiskonRaw = formData.get('biayaSewaPerangkatDiskon') as string | null
    const biayaSewaPerangkatDiskon = biayaSewaPerangkatDiskonRaw ? parseFloat(biayaSewaPerangkatDiskonRaw) : null
    const biayaLainnyaRaw = formData.get('biayaLainnya') as string | null
    const biayaLainnya = biayaLainnyaRaw ? parseInt(biayaLainnyaRaw) : null
    const biayaLainnyaIsRecurring = parseBooleanFlag(formData.get('biayaLainnyaIsRecurring'))
    const useDiskonBiayaLainnya = parseBooleanFlag(formData.get('useDiskonBiayaLainnya'))
    const biayaLainnyaDiskonRaw = formData.get('biayaLainnyaDiskon') as string | null
    const biayaLainnyaDiskon = biayaLainnyaDiskonRaw ? parseFloat(biayaLainnyaDiskonRaw) : null
    const keteranganBiayaLainnya = formData.get('keteranganBiayaLainnya') as string | null
    const odpId = formData.get('odpId') as string | null

    // For non-restricted users, if siteId is empty, it remains null (global customer?)
    // Or we might want to enforce siteId for everyone? For now, optional.

    // Parse enum values
    const tipeValue = parseEnumValue(tipe, TipePelanggan) ?? TipePelanggan.REGULER
    const statusValue = parseEnumValue(status, Status) ?? Status.AKTIF
    const discountTypeValue = parseEnumValue(discountType, DiscountType)
    const discountDurationUnitValue = parseEnumValue(discountDurationUnit, DurasiUnit)

    // Handle file uploads
    const fileKTP = formData.get('fileKTP') as File | null
    const fileRumahSekitar = formData.get('fileRumahSekitar') as File | null
    const fileBAST = formData.get('fileBAST') as File | null

    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', idPelanggan.trim())
    let fileKTPPath: string | null = null
    let fileRumahSekitarPath: string | null = null
    let fileBASTPath: string | null = null

    try {
      if (fileKTP && fileKTP.size > 0) {
        if (isImageFile(fileKTP)) {
          fileKTPPath = await convertAndSaveImage(fileKTP, pelangganUploadDir, 'ktp')
        } else {
          const ext = path.extname(fileKTP.name) || '.pdf'
          fileKTPPath = await saveFile(fileKTP, pelangganUploadDir, `ktp${ext}`)
        }
      }

      if (fileRumahSekitar && fileRumahSekitar.size > 0) {
        if (isImageFile(fileRumahSekitar)) {
          fileRumahSekitarPath = await convertAndSaveImage(fileRumahSekitar, pelangganUploadDir, 'rumah')
        } else {
          const ext = path.extname(fileRumahSekitar.name) || '.pdf'
          fileRumahSekitarPath = await saveFile(fileRumahSekitar, pelangganUploadDir, `rumah${ext}`)
        }
      }

      if (fileBAST && fileBAST.size > 0) {
        if (isImageFile(fileBAST)) {
          fileBASTPath = await convertAndSaveImage(fileBAST, pelangganUploadDir, 'bast')
        } else {
          const ext = path.extname(fileBAST.name) || '.pdf'
          fileBASTPath = await saveFile(fileBAST, pelangganUploadDir, `bast${ext}`)
        }
      }
    } catch (fileError: any) {
      console.error('Error saving files:', fileError)
    }

    // Create pelanggan using service
    const pelangganService = getPelangganService()
    const pelanggan = await pelangganService.createPelanggan({
      idPelanggan,
      nama,
      username,
      password,
      passwordLogin,
      hargaPaketId,
      tipe: tipeValue,
      tanggalAktif,
      jatuhTempo,
      status: statusValue,
      autoIsolir,
      alamat,
      provinsi,
      kabupatenKota,
      kelurahanDesa,
      kecamatan,
      noTelp,
      email,
      latitude,
      longitude,
      jenisDokumen,
      noDokumen,
      fileKTP: fileKTPPath,
      fileRumahSekitar: fileRumahSekitarPath,
      fileBAST: fileBASTPath,
      catatan,
      usePPN,
      useDiscount,
      useProrate,
      discountType: discountTypeValue,
      discountValue,
      discountDuration,
      discountDurationUnit: discountDurationUnitValue,
      biayaInstalasi,
      biayaInstalasiIsRecurring,
      biayaInstalasiDiskon: useDiskonBiayaInstalasi ? biayaInstalasiDiskon : null,
      biayaSewaPerangkat,
      biayaSewaPerangkatIsRecurring,
      biayaSewaPerangkatDiskon,
      biayaLainnya,
      biayaLainnyaIsRecurring,
      biayaLainnyaDiskon: useDiskonBiayaLainnya ? biayaLainnyaDiskon : null,
      keteranganBiayaLainnya,
      odpId,
      siteId,
    })

    // Revalidate cache
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath('/api/pelanggan-ppp')

    // System Log
    try {
      await logger.logActivity({
        action: 'CREATE',
        subject: 'Pelanggan',
        userId: session.user.id,
        details: { id: pelanggan.id, nama: pelanggan.nama, username: pelanggan.username }
      })
    } catch (logError) {
      console.error('Failed to log activity:', logError)
    }

    return NextResponse.json(pelanggan, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error: any) {
    console.error('Error creating pelanggan:', error)

    // Handle specific errors from service
    if (error.message === 'ID Pelanggan harus 8 digit angka' ||
      error.message === 'ID Pelanggan sudah digunakan' ||
      error.message === 'Username sudah digunakan') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error.message === 'Harga Paket tidak ditemukan') {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    // Handle Prisma unique constraint error
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}
