import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import path from 'path'

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

    return NextResponse.json(pelanggans)
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
    const usePPNRaw = formData.get('usePPN')
    const usePPN = usePPNRaw === 'true' || usePPNRaw === true || usePPNRaw === '1'
    const useDiscountRaw = formData.get('useDiscount')
    const useDiscount = useDiscountRaw === 'true' || useDiscountRaw === true || useDiscountRaw === '1'
    const useProrateRaw = formData.get('useProrate')
    const useProrate = useProrateRaw === 'true' || useProrateRaw === true || useProrateRaw === '1'
    const discountType = formData.get('discountType') as string | null
    const discountValueRaw = formData.get('discountValue') as string | null
    const discountValue = discountValueRaw ? parseFloat(discountValueRaw) : null
    const discountDurationRaw = formData.get('discountDuration') as string | null
    const discountDuration = discountDurationRaw ? parseInt(discountDurationRaw) : null
    const discountDurationUnit = formData.get('discountDurationUnit') as string | null
    const biayaInstalasiRaw = formData.get('biayaInstalasi') as string | null
    const biayaInstalasi = biayaInstalasiRaw ? parseInt(biayaInstalasiRaw) : null
    const biayaInstalasiIsRecurringRaw = formData.get('biayaInstalasiIsRecurring')
    const biayaInstalasiIsRecurring = biayaInstalasiIsRecurringRaw === 'true' || biayaInstalasiIsRecurringRaw === true || biayaInstalasiIsRecurringRaw === '1'
    const useDiskonBiayaInstalasiRaw = formData.get('useDiskonBiayaInstalasi')
    const useDiskonBiayaInstalasi = useDiskonBiayaInstalasiRaw === 'true' || useDiskonBiayaInstalasiRaw === true || useDiskonBiayaInstalasiRaw === '1'
    const biayaInstalasiDiskonRaw = formData.get('biayaInstalasiDiskon') as string | null
    const biayaInstalasiDiskon = biayaInstalasiDiskonRaw ? parseFloat(biayaInstalasiDiskonRaw) : null
    const biayaSewaPerangkatRaw = formData.get('biayaSewaPerangkat') as string | null
    const biayaSewaPerangkat = biayaSewaPerangkatRaw ? parseInt(biayaSewaPerangkatRaw) : null
    const biayaSewaPerangkatIsRecurringRaw = formData.get('biayaSewaPerangkatIsRecurring')
    const biayaSewaPerangkatIsRecurring = biayaSewaPerangkatIsRecurringRaw === 'true' || biayaSewaPerangkatIsRecurringRaw === true || biayaSewaPerangkatIsRecurringRaw === '1'
    const biayaSewaPerangkatDiskonRaw = formData.get('biayaSewaPerangkatDiskon') as string | null
    const biayaSewaPerangkatDiskon = biayaSewaPerangkatDiskonRaw ? parseFloat(biayaSewaPerangkatDiskonRaw) : null
    const biayaLainnyaRaw = formData.get('biayaLainnya') as string | null
    const biayaLainnya = biayaLainnyaRaw ? parseInt(biayaLainnyaRaw) : null
    const biayaLainnyaIsRecurringRaw = formData.get('biayaLainnyaIsRecurring')
    const biayaLainnyaIsRecurring = biayaLainnyaIsRecurringRaw === 'true' || biayaLainnyaIsRecurringRaw === true || biayaLainnyaIsRecurringRaw === '1'
    const useDiskonBiayaLainnyaRaw = formData.get('useDiskonBiayaLainnya')
    const useDiskonBiayaLainnya = useDiskonBiayaLainnyaRaw === 'true' || useDiskonBiayaLainnyaRaw === true || useDiskonBiayaLainnyaRaw === '1'
    const biayaLainnyaDiskonRaw = formData.get('biayaLainnyaDiskon') as string | null
    const biayaLainnyaDiskon = biayaLainnyaDiskonRaw ? parseFloat(biayaLainnyaDiskonRaw) : null
    const keteranganBiayaLainnya = formData.get('keteranganBiayaLainnya') as string | null
    const odpId = formData.get('odpId') as string | null
    
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

    // Buat pelanggan baru
    const pelanggan = await prisma.pelanggan.create({
      data: {
        idPelanggan: idPelanggan.trim(),
        nama: nama.trim(),
        username: username.trim(),
        password: password.trim(), // Password PPPoE
        passwordLogin: passwordLogin.trim(), // Password Login Portal
        hargaPaketId,
        tipe: tipe || 'REGULER',
        tanggalAktif: new Date(tanggalAktif),
        jatuhTempo: new Date(jatuhTempo),
        status: status || 'AKTIF',
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
        discountType: discountType || null,
        discountValue: discountValue || null,
        discountDuration: discountDuration || null,
        discountDurationUnit: discountDurationUnit || null,
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

    return NextResponse.json(pelanggan, { status: 201 })
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

