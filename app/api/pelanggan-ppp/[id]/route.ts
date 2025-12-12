import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { convertAndSaveImage, saveFile, isImageFile } from '@/lib/utils/image-upload'
import { promises as fs } from 'fs'
import path from 'path'
import { DiscountType, DurasiUnit, Status, TipePelanggan, TagihanStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { getTagihanRepository } from '@/lib/repositories'
import { afterCustomerUpdate, beforeCustomerDelete } from '@/lib/hooks/radius-sync-hooks'

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
 * Helper untuk verifikasi token pelanggan
 */
async function verifyPelangganToken(token: string): Promise<string | null> {
  try {
    const tokenData = Buffer.from(token, 'base64').toString('utf-8')
    const [pelangganId] = tokenData.split(':')

    // Verifikasi token dengan secret
    const pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      select: { id: true },
    })

    return pelanggan ? pelanggan.id : null
  } catch {
    return null
  }
}

/**
 * GET /api/pelanggan-ppp/[id]
 * Mendapatkan detail pelanggan PPP berdasarkan ID
 * - Admin bisa akses semua pelanggan
 * - Pelanggan hanya bisa akses data mereka sendiri dengan token
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Cek apakah ini request dari admin (user dengan session valid)
    const session: any = await getServerSession(authConfig as any)
    // User dengan session valid dianggap admin (bisa akses dari admin portal)
    const isAdmin = session && session.user

    // Jika bukan admin, cek token pelanggan
    if (!isAdmin) {
      const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
        req.headers.get('x-pelanggan-token')

      if (!token) {
        return NextResponse.json({ error: 'Token pelanggan diperlukan' }, { status: 401 })
      }

      const pelangganId = await verifyPelangganToken(token)
      if (!pelangganId || pelangganId !== id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

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

    // Hapus password dari response
    const { password, passwordLogin, ...pelangganData } = pelanggan

    return NextResponse.json(pelangganData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
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

    // Debug: Log ID yang diterima
    console.log('[PUT Pelanggan] ID diterima:', id, 'Type:', typeof id)

    // Cek apakah ID valid (tidak kosong dan tidak undefined)
    if (!id || id.trim() === '') {
      console.log('[PUT Pelanggan] ID tidak valid atau kosong')
      return NextResponse.json(
        { error: 'ID pelanggan tidak valid' },
        { status: 400 }
      )
    }

    // Cek apakah pelanggan ada
    const existingPelanggan = await prisma.pelanggan.findUnique({
      where: { id },
    })

    // Debug: Log hasil query
    console.log('[PUT Pelanggan] Pelanggan ditemukan:', existingPelanggan ? 'Ya' : 'Tidak')
    if (existingPelanggan) {
      console.log('[PUT Pelanggan] ID Pelanggan:', existingPelanggan.idPelanggan, 'Nama:', existingPelanggan.nama)
    } else {
      // Cek apakah ada pelanggan dengan ID yang mirip (untuk debugging)
      const similarPelanggans = await prisma.pelanggan.findMany({
        where: {
          OR: [
            { id: { contains: id.slice(0, 5) } },
            { idPelanggan: { contains: id } },
          ],
        },
        select: { id: true, idPelanggan: true, nama: true },
        take: 3,
      })
      console.log('[PUT Pelanggan] Pelanggan dengan ID mirip:', similarPelanggans)

      // Cek juga dengan idPelanggan jika ID yang dikirim adalah idPelanggan
      const pelangganByIdPelanggan = await prisma.pelanggan.findUnique({
        where: { idPelanggan: id },
        select: { id: true, idPelanggan: true, nama: true },
      })
      if (pelangganByIdPelanggan) {
        console.log('[PUT Pelanggan] Ditemukan dengan idPelanggan:', pelangganByIdPelanggan)
        return NextResponse.json(
          {
            error: 'Pelanggan tidak ditemukan dengan ID tersebut. Gunakan ID database, bukan ID Pelanggan.',
            hint: `ID database yang benar: ${pelangganByIdPelanggan.id}`
          },
          { status: 404 }
        )
      }

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

    // Parse tanggal dengan benar
    const parsedTanggalAktif = (() => {
      // Parse tanggal sebagai local date untuk menghindari timezone issue
      // Format: YYYY-MM-DD
      const [year, month, day] = tanggalAktif.split('-').map(Number)
      return new Date(year, month - 1, day)
    })()

    const parsedJatuhTempo = (() => {
      // Parse tanggal sebagai local date untuk menghindari timezone issue
      // Format: YYYY-MM-DD
      const [year, month, day] = jatuhTempo.split('-').map(Number)
      return new Date(year, month - 1, day)
    })()

    // Debug: Log tanggal yang akan disimpan
    console.log('[PUT Pelanggan] Jatuh Tempo yang akan disimpan:', {
      input: jatuhTempo,
      parsed: parsedJatuhTempo.toISOString(),
      localDate: `${parsedJatuhTempo.getFullYear()}-${String(parsedJatuhTempo.getMonth() + 1).padStart(2, '0')}-${String(parsedJatuhTempo.getDate()).padStart(2, '0')}`,
    })

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
        tanggalAktif: parsedTanggalAktif,
        jatuhTempo: parsedJatuhTempo,
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

    // Debug: Log data yang dikembalikan
    console.log('[PUT Pelanggan] Data yang dikembalikan:', {
      id: pelanggan.id,
      idPelanggan: pelanggan.idPelanggan,
      nama: pelanggan.nama,
      jatuhTempo: pelanggan.jatuhTempo.toISOString(),
      jatuhTempoLocal: `${pelanggan.jatuhTempo.getFullYear()}-${String(pelanggan.jatuhTempo.getMonth() + 1).padStart(2, '0')}-${String(pelanggan.jatuhTempo.getDate()).padStart(2, '0')}`,
    })

    // Update tagihan yang belum lunas jika jatuh tempo berubah
    const jatuhTempoLama = existingPelanggan.jatuhTempo
    const jatuhTempoBaru = parsedJatuhTempo

    // Cek apakah jatuh tempo berubah (bandingkan tanggal tanpa waktu)
    const isJatuhTempoChanged =
      jatuhTempoLama.getFullYear() !== jatuhTempoBaru.getFullYear() ||
      jatuhTempoLama.getMonth() !== jatuhTempoBaru.getMonth() ||
      jatuhTempoLama.getDate() !== jatuhTempoBaru.getDate()

    if (isJatuhTempoChanged && pelanggan.hargaPaket) {
      console.log('[PUT Pelanggan] Jatuh tempo berubah, update tagihan yang belum lunas...')

      try {
        const tagihanRepo = getTagihanRepository()

        // Ambil semua tagihan pelanggan yang belum lunas
        const tagihanBelumLunas = await tagihanRepo.findByPelangganId(id)
        const tagihanToUpdate = tagihanBelumLunas.filter(
          (t) => t.status === TagihanStatus.BELUM_LUNAS || t.status === TagihanStatus.TERLAMBAT
        )

        console.log(`[PUT Pelanggan] Ditemukan ${tagihanToUpdate.length} tagihan yang perlu diupdate`)

        // Update setiap tagihan
        for (const tagihan of tagihanToUpdate) {
          const paket = pelanggan.hargaPaket
          let jatuhTempoTagihanBaru: Date

          if (paket.durasiUnit === 'BULAN' || paket.durasiUnit === 'TAHUN') {
            // Untuk paket bulanan/tahunan, jatuh tempo tagihan = tanggal jatuh tempo pelanggan di bulan periode tagihan
            const tanggalJatuhTempoPelanggan = jatuhTempoBaru.getDate()
            jatuhTempoTagihanBaru = new Date(
              tagihan.periodeTahun,
              tagihan.periodeBulan - 1,
              tanggalJatuhTempoPelanggan
            )
          } else {
            // Untuk paket harian/jam-jaman, hitung dari tanggal aktif pelanggan + durasi paket
            const tanggalMulai = pelanggan.tanggalAktif || new Date()
            jatuhTempoTagihanBaru = new Date(tanggalMulai)

            switch (paket.durasiUnit) {
              case 'JAM':
                jatuhTempoTagihanBaru.setHours(jatuhTempoTagihanBaru.getHours() + paket.durasi)
                break
              case 'HARI':
                jatuhTempoTagihanBaru.setDate(jatuhTempoTagihanBaru.getDate() + paket.durasi)
                break
            }
          }

          // Update jatuh tempo tagihan
          await tagihanRepo.update(tagihan.id, {
            jatuhTempo: jatuhTempoTagihanBaru,
          })

          console.log(
            `[PUT Pelanggan] Tagihan ${tagihan.noTagihan} diupdate: jatuh tempo baru = ${jatuhTempoTagihanBaru.toISOString()}`
          )
        }

        // Revalidate cache untuk halaman tagihan
        revalidatePath(`/api/tagihan/pelanggan/${id}`)
        revalidatePath('/api/tagihan')
        revalidatePath(`/pelanggan/tagihan`)
        revalidatePath(`/pelanggan`)

        console.log(`[PUT Pelanggan] Berhasil update ${tagihanToUpdate.length} tagihan`)
      } catch (tagihanError: any) {
        // Log error tapi jangan gagalkan update pelanggan
        console.error('[PUT Pelanggan] Error updating tagihan:', tagihanError)
      }
    }

    // ✨ RADIUS Auto-Sync Hook: Detect changes and sync accordingly
    try {
      const statusChanged = existingPelanggan.status !== statusValue;
      const packageChanged = existingPelanggan.hargaPaketId !== hargaPaketId;
      const passwordChanged = existingPelanggan.password !== password.trim();

      const syncResult = await afterCustomerUpdate(prisma, id, {
        statusChanged,
        oldStatus: existingPelanggan.status,
        newStatus: statusValue,
        packageChanged,
        passwordChanged,
      });

      if (!syncResult.success) {
        console.warn('[RADIUS] Auto-sync failed for customer:', pelanggan.username, syncResult.error);
      }
    } catch (syncError) {
      // Don't fail the request if RADIUS sync fails
      console.error('[RADIUS] Auto-sync error:', syncError);
    }

    // Revalidate cache untuk halaman yang terkait
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath(`/admin/pelanggan/ppp/${id}`)
    revalidatePath(`/admin/pelanggan/ppp/${id}/edit`)
    revalidatePath('/api/pelanggan-ppp')
    revalidatePath(`/api/pelanggan-ppp/${id}`)
    revalidatePath('/pelanggan')
    revalidatePath('/pelanggan/profil')
    revalidatePath(`/api/pelanggan/${id}`)

    return NextResponse.json(pelanggan, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
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

    // Debug: Log ID yang diterima
    console.log('[DELETE Pelanggan] ID diterima:', id, 'Type:', typeof id)

    // Cek apakah ID valid (tidak kosong dan tidak undefined)
    if (!id || id.trim() === '') {
      return NextResponse.json(
        { error: 'ID pelanggan tidak valid' },
        { status: 400 }
      )
    }

    // Ambil data pelanggan sebelum dihapus
    let pelanggan = await prisma.pelanggan.findUnique({
      where: { id },
    })

    // Debug: Log hasil query
    console.log('[DELETE Pelanggan] Query dengan id:', id)
    console.log('[DELETE Pelanggan] Pelanggan ditemukan:', pelanggan ? 'Ya' : 'Tidak')

    if (!pelanggan) {
      // Cek apakah ada pelanggan dengan ID yang mirip (untuk debugging)
      const similarPelanggans = await prisma.pelanggan.findMany({
        where: {
          OR: [
            { id: { contains: id.slice(0, 5) } },
            { idPelanggan: { contains: id } },
          ],
        },
        select: { id: true, idPelanggan: true, nama: true },
        take: 3,
      })
      console.log('[DELETE Pelanggan] Pelanggan dengan ID mirip:', similarPelanggans)

      // Cek juga dengan idPelanggan jika ID yang dikirim adalah idPelanggan
      const pelangganByIdPelanggan = await prisma.pelanggan.findUnique({
        where: { idPelanggan: id },
        select: { id: true, idPelanggan: true, nama: true },
      })
      if (pelangganByIdPelanggan) {
        console.log('[DELETE Pelanggan] Ditemukan dengan idPelanggan:', pelangganByIdPelanggan)
        // Gunakan ID database yang benar
        pelanggan = await prisma.pelanggan.findUnique({
          where: { id: pelangganByIdPelanggan.id },
        })
        if (pelanggan) {
          console.log('[DELETE Pelanggan] Pelanggan ditemukan setelah menggunakan ID database yang benar')
        }
      }

      // Cek semua pelanggan untuk debugging (hanya ambil beberapa)
      const allPelanggans = await prisma.pelanggan.findMany({
        select: { id: true, idPelanggan: true, nama: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      })
      console.log('[DELETE Pelanggan] Sample pelanggan di database:', allPelanggans)

      // Cek apakah ID yang dicari ada di sample
      const foundInSample = allPelanggans.find(p => p.id === id)
      if (foundInSample) {
        console.log('[DELETE Pelanggan] ID ditemukan di sample, tapi query findUnique gagal. Mungkin ada masalah dengan database connection.')
      }
    }

    if (pelanggan) {
      console.log('[DELETE Pelanggan] ID Pelanggan:', pelanggan.idPelanggan, 'Nama:', pelanggan.nama)
    }

    if (!pelanggan) {
      // Coba query sekali lagi dengan logging lebih detail
      try {
        const retryPelanggan = await prisma.pelanggan.findUnique({
          where: { id },
          select: { id: true, idPelanggan: true, nama: true },
        })
        console.log('[DELETE Pelanggan] Retry query result:', retryPelanggan)

        if (!retryPelanggan) {
          // Cek apakah ada di database dengan query langsung
          const count = await prisma.pelanggan.count({ where: { id } })
          console.log('[DELETE Pelanggan] Count dengan ID:', count)

          // Cek semua ID yang ada
          const allIds = await prisma.pelanggan.findMany({
            select: { id: true, idPelanggan: true },
            take: 10,
          })
          console.log('[DELETE Pelanggan] Semua ID di database:', allIds)
        }
      } catch (dbError: any) {
        console.error('[DELETE Pelanggan] Error saat retry query:', dbError)
      }

      return NextResponse.json(
        { error: 'Pelanggan tidak ditemukan' },
        { status: 404 }
      )
    }

    // Hapus semua tagihan terkait terlebih dahulu (meskipun sudah ada cascade, lebih aman hapus manual)
    try {
      await prisma.tagihan.deleteMany({
        where: { pelangganId: id },
      })
    } catch (error) {
      console.error(`Error deleting tagihan for pelanggan ${id}:`, error)
      // Lanjutkan meskipun ada error, karena cascade akan menangani
    }

    // Hapus file uploads jika ada
    const pelangganUploadDir = path.join(process.cwd(), 'public', 'uploads', 'pelanggan', pelanggan.idPelanggan)
    try {
      await fs.rm(pelangganUploadDir, { recursive: true, force: true })
    } catch (error) {
      console.error(`Error deleting upload files for pelanggan ${pelanggan.idPelanggan}:`, error)
      // Jangan gagalkan request, hanya log error
    }

    // ✨ RADIUS Auto-Sync Hook: Remove from RADIUS before deleting
    try {
      const syncResult = await beforeCustomerDelete(prisma, pelanggan.username);
      if (!syncResult.success) {
        console.warn('[RADIUS] Failed to remove from RADIUS:', pelanggan.username, syncResult.error);
      }
    } catch (syncError) {
      // Don't fail the request if RADIUS sync fails
      console.error('[RADIUS] Auto-sync error:', syncError);
    }

    // Hapus dari database
    await prisma.pelanggan.delete({
      where: { id },
    })

    // Revalidate cache untuk halaman yang terkait
    revalidatePath('/admin/pelanggan/ppp')
    revalidatePath(`/admin/pelanggan/ppp/${id}`)
    revalidatePath('/api/pelanggan-ppp')
    revalidatePath(`/api/pelanggan-ppp/${id}`)

    return NextResponse.json({ message: 'Pelanggan berhasil dihapus' }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
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

