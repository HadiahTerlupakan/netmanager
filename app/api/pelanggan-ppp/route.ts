import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import { hash } from 'bcryptjs'
import path from 'path'
import { DiscountType, DurasiUnit, Status, TipePelanggan } from '@prisma/client'
import { afterCustomerCreate } from '@/lib/hooks/radius-sync-hooks'

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
 * GET /api/pelanggan-ppp
 * Mendapatkan daftar pelanggan PPP
 */
export async function GET(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) {
      where.status = status
    }

    const pelanggans = await prisma.pelanggan.findMany({
      where,
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

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
 * POST /api/pelanggan-ppp
 * Membuat pelanggan PPP baru
 */
export async function POST(req: NextRequest) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()

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
    const tipeValue = parseEnumValue(tipe, TipePelanggan) ?? TipePelanggan.REGULER
    const statusValue = parseEnumValue(status, Status) ?? Status.AKTIF
    const discountTypeValue = parseEnumValue(discountType, DiscountType)
    const discountDurationUnitValue = parseEnumValue(discountDurationUnit, DurasiUnit)

    // Handle file uploads dengan struktur folder yang rapi
    // Struktur: public/uploads/pelanggan/ID_PELANGGAN/ktp.webp, rumah.webp, bast.webp
    const fileKTP = formData.get('fileKTP') as File | null
    const fileRumahSekitar = formData.get('fileRumahSekitar') as File | null
    const fileBAST = formData.get('fileBAST') as File | null

    // Direktori untuk pelanggan ini (berdasarkan ID)
    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', idPelanggan.trim())
    let fileKTPPath: string | null = null
    let fileRumahSekitarPath: string | null = null
    let fileBASTPath: string | null = null

    try {
      // Simpan file KTP (selalu konversi ke WebP jika gambar)
      if (fileKTP && fileKTP.size > 0) {
        if (isImageFile(fileKTP)) {
          // Konversi gambar ke WebP
          fileKTPPath = await convertAndSaveImage(fileKTP, pelangganUploadDir, 'ktp')
        } else {
          // Jika bukan gambar, simpan as-is (untuk PDF dll)
          const ext = path.extname(fileKTP.name) || '.pdf'
          fileKTPPath = await saveFile(fileKTP, pelangganUploadDir, `ktp${ext}`)
        }
      }

      // Simpan file Rumah Sekitar (selalu konversi ke WebP jika gambar)
      if (fileRumahSekitar && fileRumahSekitar.size > 0) {
        if (isImageFile(fileRumahSekitar)) {
          // Konversi gambar ke WebP
          fileRumahSekitarPath = await convertAndSaveImage(fileRumahSekitar, pelangganUploadDir, 'rumah')
        } else {
          // Jika bukan gambar, simpan as-is
          const ext = path.extname(fileRumahSekitar.name) || '.pdf'
          fileRumahSekitarPath = await saveFile(fileRumahSekitar, pelangganUploadDir, `rumah${ext}`)
        }
      }

      // Simpan file BAST (selalu konversi ke WebP jika gambar)
      if (fileBAST && fileBAST.size > 0) {
        if (isImageFile(fileBAST)) {
          // Konversi gambar ke WebP
          fileBASTPath = await convertAndSaveImage(fileBAST, pelangganUploadDir, 'bast')
        } else {
          // Jika bukan gambar, simpan as-is
          const ext = path.extname(fileBAST.name) || '.pdf'
          fileBASTPath = await saveFile(fileBAST, pelangganUploadDir, `bast${ext}`)
        }
      }
    } catch (fileError: any) {
      console.error('Error saving files:', fileError)
      // Continue without files if there's an error
    }

    // Validasi required fields
    if (!idPelanggan || !nama || !username || !password || !passwordLogin || !hargaPaketId || !tanggalAktif || !jatuhTempo) {
      return NextResponse.json(
        { error: 'Semua field wajib harus diisi' },
        { status: 400 }
      )
    }

    // Validasi format ID Pelanggan (8 digit angka)
    if (!/^\d{8}$/.test(idPelanggan.trim())) {
      return NextResponse.json(
        { error: 'ID Pelanggan harus 8 digit angka' },
        { status: 400 }
      )
    }

    // Cek apakah ID Pelanggan sudah ada
    const existingPelanggan = await prisma.pelanggan.findUnique({
      where: { idPelanggan: idPelanggan.trim() },
    })

    if (existingPelanggan) {
      return NextResponse.json(
        { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
        { status: 409 }
      )
    }

    // Cek apakah HargaPaket ada
    const hargaPaket = await prisma.hargaPaket.findUnique({
      where: { id: hargaPaketId },
    })

    if (!hargaPaket) {
      return NextResponse.json(
        { error: 'Harga Paket tidak ditemukan' },
        { status: 404 }
      )
    }

    // Hash passwordLogin dengan bcrypt (salt rounds = 12)
    const hashedPasswordLogin = await hash(passwordLogin.trim(), 12)

    // Buat pelanggan baru
    const pelanggan = await prisma.pelanggan.create({
      data: {
        idPelanggan: idPelanggan.trim(),
        nama: nama.trim(),
        username: username.trim(),
        password: password.trim(), // Password PPPoE
        passwordLogin: passwordLogin.trim(), // Password Login Portal (plain text untuk backward compatibility)
        passwordHash: hashedPasswordLogin, // Hash dari passwordLogin
        hargaPaketId,
        tipe: tipeValue,
        tanggalAktif: (() => {
          // Parse tanggal sebagai local date untuk menghindari timezone issue
          // Format: YYYY-MM-DD
          const [year, month, day] = tanggalAktif.split('-').map(Number)
          return new Date(year, month - 1, day)
        })(),
        jatuhTempo: (() => {
          // Parse tanggal sebagai local date untuk menghindari timezone issue
          // Format: YYYY-MM-DD
          const [year, month, day] = jatuhTempo.split('-').map(Number)
          return new Date(year, month - 1, day)
        })(),
        status: statusValue,
        alamat: alamat?.trim() || null,
        provinsi: provinsi?.trim() || null,
        kabupatenKota: kabupatenKota?.trim() || null,
        kelurahanDesa: kelurahanDesa?.trim() || null,
        kecamatan: kecamatan?.trim() || null,
        noTelp: noTelp?.trim() || null,
        email: email?.trim() || null,
        latitude: latitude || null,
        longitude: longitude || null,
        jenisDokumen: jenisDokumen || null,
        noDokumen: noDokumen?.trim() || null,
        fileKTP: fileKTPPath || null,
        fileRumahSekitar: fileRumahSekitarPath || null,
        fileBAST: fileBASTPath || null,
        catatan: catatan?.trim() || null,
        usePPN: usePPN ?? true,
        useDiscount: useDiscount ?? false,
        useProrate: useProrate ?? false,
        discountType: discountTypeValue,
        discountValue: discountValue || null,
        discountDuration: discountDuration || null,
        discountDurationUnit: discountDurationUnitValue,
        biayaInstalasi: biayaInstalasi || null,
        biayaInstalasiIsRecurring: biayaInstalasiIsRecurring ?? false,
        biayaInstalasiDiskon: useDiskonBiayaInstalasi ? (biayaInstalasiDiskon || null) : null,
        biayaSewaPerangkat: biayaSewaPerangkat || null,
        biayaSewaPerangkatIsRecurring: biayaSewaPerangkatIsRecurring ?? true,
        biayaSewaPerangkatDiskon: biayaSewaPerangkatDiskon || null,
        biayaLainnya: biayaLainnya || null,
        biayaLainnyaIsRecurring: biayaLainnyaIsRecurring ?? false,
        biayaLainnyaDiskon: useDiskonBiayaLainnya ? (biayaLainnyaDiskon || null) : null,
        keteranganBiayaLainnya: keteranganBiayaLainnya?.trim() || null,
        odpId: odpId?.trim() || null,
      },
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
      },
    })

    // ✨ RADIUS Auto-Sync Hook: Sync new customer to RADIUS
    try {
      const syncResult = await afterCustomerCreate(prisma, pelanggan.id);
      if (!syncResult.success) {
        console.warn('[RADIUS] Auto-sync failed for customer:', pelanggan.username, syncResult.error);
      }
    } catch (syncError) {
      // Don't fail the request if RADIUS sync fails
      console.error('[RADIUS] Auto-sync error:', syncError);
    }

    // Revalidate cache untuk halaman yang terkait
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath('/api/pelanggan-ppp')

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

