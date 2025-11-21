import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import { promises as fs } from 'fs'
import path from 'path'
import { DiscountType, DurasiUnit, Status, TipePelanggan } from '@prisma/client'

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
 * GET /api/pelanggan-ppp/[id]
 * Mendapatkan detail pelanggan PPP berdasarkan ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
      include: {
        hargaPaket: {
          include: {
            profilePPP: true,
            bandwidth: true,
          },
        },
        odp: true,
      },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(pelanggan)
  } catch (error: any) {
    console.error('Error fetching pelanggan:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/pelanggan-ppp/[id]
 * Update pelanggan PPP
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Cek apakah pelanggan ada
    const existingPelanggan = await prisma.pelanggan.findUnique({
      where: { id },
    })

    if (!existingPelanggan) {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
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

    // Cek apakah ID Pelanggan sudah digunakan oleh pelanggan lain (jika diubah)
    if (idPelanggan.trim() !== existingPelanggan.idPelanggan) {
      const existingIdPelanggan = await prisma.pelanggan.findUnique({
        where: { idPelanggan: idPelanggan.trim() },
      })

      if (existingIdPelanggan) {
        return NextResponse.json(
          { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
          { status: 409 }
        )
      }
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

    // Handle file uploads
    const fileKTP = formData.get('fileKTP') as File | null
    const fileRumahSekitar = formData.get('fileRumahSekitar') as File | null
    const fileBAST = formData.get('fileBAST') as File | null

    // Direktori untuk pelanggan ini (berdasarkan ID Pelanggan baru jika diubah)
    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', idPelanggan.trim())
    const oldPelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', existingPelanggan.idPelanggan)

    let fileKTPPath: string | null = existingPelanggan.fileKTP
    let fileRumahSekitarPath: string | null = existingPelanggan.fileRumahSekitar
    let fileBASTPath: string | null = existingPelanggan.fileBAST

    try {
      // Jika ID Pelanggan berubah, pindahkan folder upload
      if (idPelanggan.trim() !== existingPelanggan.idPelanggan) {
        try {
          // Cek apakah folder lama ada
          await fs.access(oldPelangganUploadDir)
          // Pindahkan folder ke lokasi baru
          await fs.rename(oldPelangganUploadDir, pelangganUploadDir)
        } catch (error) {
          // Folder lama tidak ada, buat folder baru
          await fs.mkdir(pelangganUploadDir, { recursive: true })
        }
      }

      // Simpan file KTP baru jika ada
      if (fileKTP && fileKTP.size > 0) {
        // Hapus file KTP lama jika ada
        if (existingPelanggan.fileKTP) {
          try {
            const oldFilePath = path.join(process.cwd(), 'public', existingPelanggan.fileKTP)
            await fs.unlink(oldFilePath)
          } catch (error) {
            // File tidak ada, lanjutkan
          }
        }

        if (isImageFile(fileKTP)) {
          fileKTPPath = await convertAndSaveImage(fileKTP, pelangganUploadDir, 'ktp')
        } else {
          const ext = path.extname(fileKTP.name) || '.pdf'
          fileKTPPath = await saveFile(fileKTP, pelangganUploadDir, `ktp${ext}`)
        }
      }

      // Simpan file Rumah Sekitar baru jika ada
      if (fileRumahSekitar && fileRumahSekitar.size > 0) {
        // Hapus file lama jika ada
        if (existingPelanggan.fileRumahSekitar) {
          try {
            const oldFilePath = path.join(process.cwd(), 'public', existingPelanggan.fileRumahSekitar)
            await fs.unlink(oldFilePath)
          } catch (error) {
            // File tidak ada, lanjutkan
          }
        }

        if (isImageFile(fileRumahSekitar)) {
          fileRumahSekitarPath = await convertAndSaveImage(fileRumahSekitar, pelangganUploadDir, 'rumah')
        } else {
          const ext = path.extname(fileRumahSekitar.name) || '.pdf'
          fileRumahSekitarPath = await saveFile(fileRumahSekitar, pelangganUploadDir, `rumah${ext}`)
        }
      }

      // Simpan file BAST baru jika ada
      if (fileBAST && fileBAST.size > 0) {
        // Hapus file lama jika ada
        if (existingPelanggan.fileBAST) {
          try {
            const oldFilePath = path.join(process.cwd(), 'public', existingPelanggan.fileBAST)
            await fs.unlink(oldFilePath)
          } catch (error) {
            // File tidak ada, lanjutkan
          }
        }

        if (isImageFile(fileBAST)) {
          fileBASTPath = await convertAndSaveImage(fileBAST, pelangganUploadDir, 'bast')
        } else {
          const ext = path.extname(fileBAST.name) || '.pdf'
          fileBASTPath = await saveFile(fileBAST, pelangganUploadDir, `bast${ext}`)
        }
      }
    } catch (fileError: any) {
      console.error('Error saving files:', fileError)
      // Continue without files if there's an error
    }

    // Update pelanggan
    const pelanggan = await prisma.pelanggan.update({
      where: { id },
      data: {
        idPelanggan: idPelanggan.trim(),
        nama: nama.trim(),
        username: username.trim(),
        password: password.trim(),
        passwordLogin: passwordLogin.trim(),
        hargaPaketId,
        tipe: tipeValue,
        tanggalAktif: new Date(tanggalAktif),
        jatuhTempo: new Date(jatuhTempo),
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

    return NextResponse.json(pelanggan)
  } catch (error: any) {
    console.error('Error updating pelanggan:', error)

    // Handle Prisma unique constraint error
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'ID Pelanggan sudah digunakan. Silakan gunakan ID lain.' },
        { status: 409 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/pelanggan-ppp/[id]
 * Hapus pelanggan PPP
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Cek autentikasi
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Ambil data pelanggan sebelum dihapus
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
    })

    if (!pelanggan) {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Hapus file uploads jika ada
    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', pelanggan.idPelanggan)
    try {
      await fs.rm(pelangganUploadDir, { recursive: true, force: true })
    } catch (error) {
      console.error(`Error deleting upload files for pelanggan ${pelanggan.idPelanggan}:`, error)
      // Jangan gagalkan request, hanya log error
    }

    // Hapus dari database
    await prisma.pelanggan.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Pelanggan berhasil dihapus' })
  } catch (error: any) {
    console.error('Error deleting pelanggan:', error)

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Pelanggan tidak dapat dihapus karena masih digunakan' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

