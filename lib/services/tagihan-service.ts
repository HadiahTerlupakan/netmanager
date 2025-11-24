import { prisma } from '@/lib/prisma'
import { getTagihanRepository } from '@/lib/repositories'
import type { TagihanCreateData } from '@/lib/repositories/ITagihanRepository'
import { TagihanStatus } from '@prisma/client'

interface PerhitunganTagihan {
  subtotal: number
  diskon: number
  ppn: number
  biayaInstalasi: number
  biayaSewaPerangkat: number
  biayaLainnya: number
  total: number
}

/**
 * Helper: Cek apakah diskon masih berlaku berdasarkan durasi
 */
function isDiscountStillValid(
  tanggalAktif: Date,
  discountDuration: number | null,
  discountDurationUnit: string | null,
): boolean {
  if (!discountDuration || !discountDurationUnit) {
    return true // Diskon tanpa durasi berlaku selamanya
  }

  const sekarang = new Date()
  const tanggalMulaiDiskon = new Date(tanggalAktif)
  let tanggalBerakhirDiskon = new Date(tanggalMulaiDiskon)

  // Hitung tanggal berakhir diskon
  switch (discountDurationUnit) {
    case 'JAM':
      tanggalBerakhirDiskon.setHours(tanggalBerakhirDiskon.getHours() + discountDuration)
      break
    case 'HARI':
      tanggalBerakhirDiskon.setDate(tanggalBerakhirDiskon.getDate() + discountDuration)
      break
    case 'BULAN':
      tanggalBerakhirDiskon.setMonth(tanggalBerakhirDiskon.getMonth() + discountDuration)
      break
    case 'TAHUN':
      tanggalBerakhirDiskon.setFullYear(tanggalBerakhirDiskon.getFullYear() + discountDuration)
      break
  }

  return sekarang <= tanggalBerakhirDiskon
}

/**
 * Menghitung tagihan berdasarkan data pelanggan
 * Mengimplementasikan semua fitur: prorate, diskon dengan durasi, biaya tambahan dengan diskon
 */
export async function hitungTagihan(
  pelangganId: string,
  periodeBulan?: number,
  periodeTahun?: number,
): Promise<PerhitunganTagihan> {
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    include: {
      hargaPaket: true,
    },
  })

  if (!pelanggan) {
    throw new Error('Pelanggan tidak ditemukan')
  }

  if (!pelanggan.hargaPaket) {
    throw new Error('Paket pelanggan tidak ditemukan')
  }

  // Mulai dari harga paket
  let subtotal = pelanggan.hargaPaket.harga

  // Hitung PRORATE jika diaktifkan
  if (pelanggan.useProrate && pelanggan.tanggalAktif && pelanggan.jatuhTempo) {
    const tanggalAktif = new Date(pelanggan.tanggalAktif)
    const jatuhTempo = new Date(pelanggan.jatuhTempo)
    const selisihHari = Math.ceil(
      (jatuhTempo.getTime() - tanggalAktif.getTime()) / (1000 * 60 * 60 * 24),
    )

    // Hitung durasi paket dalam hari
    let durasiPaketHari = 0
    const paket = pelanggan.hargaPaket
    switch (paket.durasiUnit) {
      case 'JAM':
        durasiPaketHari = paket.durasi / 24
        break
      case 'HARI':
        durasiPaketHari = paket.durasi
        break
      case 'BULAN':
        durasiPaketHari = paket.durasi * 30 // Approximasi 30 hari per bulan
        break
      case 'TAHUN':
        durasiPaketHari = paket.durasi * 365 // Approximasi 365 hari per tahun
        break
    }

    if (durasiPaketHari > 0 && selisihHari > 0) {
      // Hitung prorate ratio (bisa lebih dari 1 jika periode melebihi durasi paket)
      const prorateRatio = selisihHari / durasiPaketHari
      subtotal = Math.round(subtotal * prorateRatio)
    }
  }

  // Hitung diskon (prioritas: custom diskon pelanggan > diskon paket)
  let diskon = 0
  if (pelanggan.useDiscount) {
    // Cek custom diskon pelanggan
    if (
      pelanggan.discountType &&
      pelanggan.discountValue !== null &&
      isDiscountStillValid(
        pelanggan.tanggalAktif,
        pelanggan.discountDuration,
        pelanggan.discountDurationUnit,
      )
    ) {
      if (pelanggan.discountType === 'FIXED') {
        diskon = pelanggan.discountValue
      } else if (pelanggan.discountType === 'PERCENT') {
        diskon = (subtotal * pelanggan.discountValue) / 100
      }
    }
    // Fallback ke diskon paket jika custom diskon tidak ada atau sudah tidak berlaku
    else if (
      pelanggan.hargaPaket.useDiscount &&
      pelanggan.hargaPaket.discountType &&
      pelanggan.hargaPaket.discountValue &&
      isDiscountStillValid(
        pelanggan.tanggalAktif,
        pelanggan.hargaPaket.discountDuration,
        pelanggan.hargaPaket.discountDurationUnit,
      )
    ) {
      if (pelanggan.hargaPaket.discountType === 'FIXED') {
        diskon = pelanggan.hargaPaket.discountValue
      } else if (pelanggan.hargaPaket.discountType === 'PERCENT') {
        diskon = (subtotal * pelanggan.hargaPaket.discountValue) / 100
      }
    }
  }
  subtotal = Math.max(0, subtotal - diskon)

  // Hitung biaya tambahan (hanya jika recurring)
  let biayaInstalasi = 0
  if (pelanggan.biayaInstalasi && pelanggan.biayaInstalasiIsRecurring) {
    biayaInstalasi = pelanggan.biayaInstalasi
    // Diskon biaya instalasi (jika ada)
    if (pelanggan.biayaInstalasiDiskon && pelanggan.biayaInstalasiDiskon > 0) {
      const diskonInstalasi = (biayaInstalasi * pelanggan.biayaInstalasiDiskon) / 100
      biayaInstalasi = Math.max(0, biayaInstalasi - diskonInstalasi)
    }
  }

  let biayaSewaPerangkat = 0
  if (pelanggan.biayaSewaPerangkat && pelanggan.biayaSewaPerangkatIsRecurring) {
    biayaSewaPerangkat = pelanggan.biayaSewaPerangkat
    // Diskon sewa perangkat (jika ada)
    if (pelanggan.biayaSewaPerangkatDiskon && pelanggan.biayaSewaPerangkatDiskon > 0) {
      const diskonSewa = (biayaSewaPerangkat * pelanggan.biayaSewaPerangkatDiskon) / 100
      biayaSewaPerangkat = Math.max(0, biayaSewaPerangkat - diskonSewa)
    }
  }

  let biayaLainnya = 0
  if (pelanggan.biayaLainnya && pelanggan.biayaLainnyaIsRecurring) {
    biayaLainnya = pelanggan.biayaLainnya
    // Diskon biaya lain-lain (jika ada)
    if (pelanggan.biayaLainnyaDiskon && pelanggan.biayaLainnyaDiskon > 0) {
      const diskonLainnya = (biayaLainnya * pelanggan.biayaLainnyaDiskon) / 100
      biayaLainnya = Math.max(0, biayaLainnya - diskonLainnya)
    }
  }

  // Hitung subtotal keseluruhan (paket + biaya tambahan)
  const subtotalKeseluruhan = subtotal + biayaInstalasi + biayaSewaPerangkat + biayaLainnya

  // Hitung PPN (dari subtotal keseluruhan setelah diskon)
  let ppn = 0
  if (pelanggan.usePPN && pelanggan.hargaPaket.usePPN && pelanggan.hargaPaket.ppnPercentage) {
    ppn = (subtotalKeseluruhan * pelanggan.hargaPaket.ppnPercentage) / 100
  }

  // Total = subtotal keseluruhan + ppn
  const total = subtotalKeseluruhan + ppn

  return {
    subtotal: Math.round(subtotal),
    diskon: Math.round(diskon),
    ppn: Math.round(ppn),
    biayaInstalasi: Math.round(biayaInstalasi),
    biayaSewaPerangkat: Math.round(biayaSewaPerangkat),
    biayaLainnya: Math.round(biayaLainnya),
    total: Math.round(total),
  }
}

/**
 * Generate nomor tagihan (format: TAG-YYYYMM-XXXX)
 */
function generateNoTagihan(periodeBulan: number, periodeTahun: number): string {
  const bulanStr = periodeBulan.toString().padStart(2, '0')
  const tahunStr = periodeTahun.toString()
  const randomStr = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0')
  return `TAG-${tahunStr}${bulanStr}-${randomStr}`
}

/**
 * Generate tagihan untuk pelanggan pada periode tertentu
 */
export async function generateTagihan(
  pelangganId: string,
  periodeBulan: number,
  periodeTahun: number,
): Promise<{ id: string }> {
  const tagihanRepo = getTagihanRepository()

  // Cek apakah tagihan sudah ada
  const existingTagihan = await tagihanRepo.findByPelangganAndPeriode(
    pelangganId,
    periodeBulan,
    periodeTahun,
  )

  if (existingTagihan) {
    throw new Error('Tagihan untuk periode ini sudah ada')
  }

  // Ambil data pelanggan dengan paket untuk perhitungan
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    include: {
      hargaPaket: true,
    },
  })

  if (!pelanggan) {
    throw new Error('Pelanggan tidak ditemukan')
  }

  if (!pelanggan.hargaPaket) {
    throw new Error('Paket pelanggan tidak ditemukan')
  }

  // Hitung tagihan (dengan prorate jika diaktifkan)
  const perhitungan = await hitungTagihan(pelangganId, periodeBulan, periodeTahun)

  // Hitung jatuh tempo tagihan berdasarkan durasi paket
  let jatuhTempo: Date
  const paket = pelanggan.hargaPaket

  if (paket.durasiUnit === 'BULAN' || paket.durasiUnit === 'TAHUN') {
    // Untuk paket bulanan/tahunan, jatuh tempo = tanggal jatuh tempo pelanggan di bulan periode
    if (pelanggan.jatuhTempo) {
      jatuhTempo = new Date(periodeTahun, periodeBulan - 1, pelanggan.jatuhTempo.getDate())
    } else {
      // Default: tanggal 1 bulan berikutnya
      jatuhTempo = new Date(periodeTahun, periodeBulan, 1)
    }
  } else {
    // Untuk paket harian/jam-jaman, hitung jatuh tempo dari tanggal aktif pelanggan + durasi paket
    // Atau jika tidak ada tanggal aktif, gunakan tanggal saat ini
    const tanggalMulai = pelanggan.tanggalAktif || new Date()
    jatuhTempo = new Date(tanggalMulai)

    switch (paket.durasiUnit) {
      case 'JAM':
        jatuhTempo.setHours(jatuhTempo.getHours() + paket.durasi)
        break
      case 'HARI':
        jatuhTempo.setDate(jatuhTempo.getDate() + paket.durasi)
        break
    }

    // Jika jatuh tempo sudah lewat, hitung dari tanggal saat ini
    const sekarang = new Date()
    if (jatuhTempo < sekarang) {
      jatuhTempo = new Date(sekarang)
      switch (paket.durasiUnit) {
        case 'JAM':
          jatuhTempo.setHours(jatuhTempo.getHours() + paket.durasi)
          break
        case 'HARI':
          jatuhTempo.setDate(jatuhTempo.getDate() + paket.durasi)
          break
      }
    }
  }

  // Generate nomor tagihan
  let noTagihan = generateNoTagihan(periodeBulan, periodeTahun)
  // Pastikan nomor tagihan unik
  while (await tagihanRepo.findByNoTagihan(noTagihan)) {
    noTagihan = generateNoTagihan(periodeBulan, periodeTahun)
  }

  // Buat tagihan
  const tagihanData: TagihanCreateData = {
    pelangganId,
    noTagihan,
    periodeBulan,
    periodeTahun,
    subtotal: perhitungan.subtotal,
    diskon: perhitungan.diskon,
    ppn: perhitungan.ppn,
    biayaInstalasi: perhitungan.biayaInstalasi,
    biayaSewaPerangkat: perhitungan.biayaSewaPerangkat,
    biayaLainnya: perhitungan.biayaLainnya,
    total: perhitungan.total,
    jatuhTempo,
  }

  return await tagihanRepo.create(tagihanData)
}

/**
 * Generate tagihan bulanan untuk semua pelanggan aktif
 * Sistem akan generate tagihan berdasarkan durasi paket dan tipe pelanggan:
 * - REGULER: Auto-generate tagihan bulanan
 * - NON_REGULER: Tidak auto-generate (hanya manual atau saat renewal)
 * - Paket bulanan/tahunan: generate untuk periode bulan/tahun yang sesuai
 * - Paket harian/jam-jaman: generate jika jatuh tempo sudah lewat atau mendekati
 */
export async function generateTagihanBulanan(periodeBulan: number, periodeTahun: number): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const pelanggans = await prisma.pelanggan.findMany({
    where: {
      status: 'AKTIF',
      tipe: 'REGULER', // Hanya generate untuk pelanggan REGULER
    },
    include: {
      hargaPaket: true,
    },
  })

  let success = 0
  let failed = 0
  const errors: string[] = []
  const sekarang = new Date()

  for (const pelanggan of pelanggans) {
    try {
      if (!pelanggan.hargaPaket) {
        errors.push(
          `Pelanggan ${pelanggan.nama} (${pelanggan.idPelanggan}): Paket tidak ditemukan`,
        )
        failed++
        continue
      }

      // Tentukan apakah perlu generate tagihan berdasarkan durasi paket
      let perluGenerate = false
      let periodeBulanTagihan = periodeBulan
      let periodeTahunTagihan = periodeTahun

      const paket = pelanggan.hargaPaket
      const jatuhTempo = new Date(pelanggan.jatuhTempo)

      if (paket.durasiUnit === 'BULAN' || paket.durasiUnit === 'TAHUN') {
        // Untuk paket bulanan/tahunan, generate untuk periode bulan/tahun yang sesuai
        // Cek apakah jatuh tempo sudah lewat atau jatuh tempo di bulan periode ini
        const jatuhTempoBulan = jatuhTempo.getMonth() + 1
        const jatuhTempoTahun = jatuhTempo.getFullYear()

        if (
          jatuhTempo <= sekarang ||
          (jatuhTempoBulan === periodeBulan && jatuhTempoTahun === periodeTahun)
        ) {
          perluGenerate = true
          periodeBulanTagihan = jatuhTempoBulan
          periodeTahunTagihan = jatuhTempoTahun
        }
      } else {
        // Untuk paket harian/jam-jaman, generate jika jatuh tempo sudah lewat
        if (jatuhTempo <= sekarang) {
          perluGenerate = true
          // Gunakan periode bulan/tahun dari jatuh tempo
          periodeBulanTagihan = jatuhTempo.getMonth() + 1
          periodeTahunTagihan = jatuhTempo.getFullYear()
        }
      }

      if (perluGenerate) {
        await generateTagihan(pelanggan.id, periodeBulanTagihan, periodeTahunTagihan)
        success++
      }
    } catch (error: any) {
      failed++
      errors.push(`Pelanggan ${pelanggan.nama} (${pelanggan.idPelanggan}): ${error.message}`)
    }
  }

  return { success, failed, errors }
}

/**
 * Generate tagihan otomatis berdasarkan pengaturan (X hari sebelum jatuh tempo)
 * Fungsi ini akan membuat invoice untuk pelanggan yang jatuh temponya akan datang dalam X hari
 * sesuai dengan pengaturan GENERAL_INVOICE_OTOMATIS
 */
export async function generateTagihanOtomatis(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  // Ambil pengaturan invoice otomatis
  const invoiceOtomatisSetting = await prisma.settings.findUnique({
    where: { key: 'GENERAL_INVOICE_OTOMATIS' },
  })

  const hariSebelumJatuhTempo = invoiceOtomatisSetting?.value 
    ? parseInt(invoiceOtomatisSetting.value, 10) 
    : 5 // Default 5 hari

  if (isNaN(hariSebelumJatuhTempo) || hariSebelumJatuhTempo < 0) {
    console.warn('[GenerateTagihanOtomatis] Pengaturan invoice otomatis tidak valid, menggunakan default 5 hari')
  }

  const pelanggans = await prisma.pelanggan.findMany({
    where: {
      status: 'AKTIF',
      tipe: 'REGULER', // Hanya untuk pelanggan REGULER
    },
    include: {
      hargaPaket: true,
      tagihans: {
        where: {
          status: {
            in: ['BELUM_BAYAR', 'TERLAMBAT'],
          },
        },
        orderBy: {
          jatuhTempo: 'desc',
        },
        take: 1,
      },
    },
  })

  let success = 0
  let failed = 0
  const errors: string[] = []
  const sekarang = new Date()
  const targetDate = new Date(sekarang)
  targetDate.setDate(targetDate.getDate() + hariSebelumJatuhTempo)

  for (const pelanggan of pelanggans) {
    try {
      if (!pelanggan.hargaPaket) {
        errors.push(
          `Pelanggan ${pelanggan.nama} (${pelanggan.idPelanggan}): Paket tidak ditemukan`,
        )
        failed++
        continue
      }

      // Cek apakah ada tagihan belum bayar
      // Sesuai dengan keterangan: "INVOICE BELUM BAYAR PADA DATA PELANGGAN (HOTSPOT / PPP) HARUS SUDAH TERBAYARKAN SEBELUM PERIODE YANG DIPILIH"
      if (pelanggan.tagihans && pelanggan.tagihans.length > 0) {
        // Ada tagihan belum bayar, skip generate invoice baru
        continue
      }

      const jatuhTempo = new Date(pelanggan.jatuhTempo)
      
      // Cek apakah jatuh tempo akan datang dalam X hari
      // Hitung selisih hari antara sekarang dan jatuh tempo
      const selisihHari = Math.ceil(
        (jatuhTempo.getTime() - sekarang.getTime()) / (1000 * 60 * 60 * 24)
      )

      // Generate invoice jika jatuh tempo akan datang dalam X hari (atau sudah lewat)
      if (selisihHari <= hariSebelumJatuhTempo && selisihHari >= 0) {
        // Tentukan periode untuk tagihan
        const periodeBulan = jatuhTempo.getMonth() + 1
        const periodeTahun = jatuhTempo.getFullYear()

        // Cek apakah tagihan untuk periode ini sudah ada
        const existingTagihan = await getTagihanRepository().findByPelangganAndPeriode(
          pelanggan.id,
          periodeBulan,
          periodeTahun,
        )

        if (!existingTagihan) {
          await generateTagihan(pelanggan.id, periodeBulan, periodeTahun)
          success++
        }
      }
    } catch (error: any) {
      failed++
      errors.push(`Pelanggan ${pelanggan.nama} (${pelanggan.idPelanggan}): ${error.message}`)
    }
  }

  return { success, failed, errors }
}

/**
 * Helper: Cek apakah perpanjangan paket harus di-disable berdasarkan pengaturan
 * @param jatuhTempo - Jatuh tempo pelanggan
 * @returns true jika perpanjangan harus di-disable, false jika boleh diperpanjang
 */
export async function shouldDisablePerpanjanganPaket(jatuhTempo: Date): Promise<{
  disabled: boolean
  hariSebelumJatuhTempo: number
  selisihHari: number
}> {
  // Ambil pengaturan disable perpanjangan paket
  const disablePerpanjanganSetting = await prisma.settings.findUnique({
    where: { key: 'GENERAL_DISABLE_PERPANJANGAN_PAKET' },
  })

  const hariSebelumJatuhTempo = disablePerpanjanganSetting?.value 
    ? parseInt(disablePerpanjanganSetting.value, 10) 
    : 5 // Default 5 hari

  if (isNaN(hariSebelumJatuhTempo) || hariSebelumJatuhTempo < 0) {
    return {
      disabled: false,
      hariSebelumJatuhTempo: 5,
      selisihHari: 0,
    }
  }

  const sekarang = new Date()
  const selisihHari = Math.ceil(
    (jatuhTempo.getTime() - sekarang.getTime()) / (1000 * 60 * 60 * 24)
  )

  // Disable jika sudah masuk periode (selisih hari <= hariSebelumJatuhTempo)
  const disabled = selisihHari <= hariSebelumJatuhTempo

  return {
    disabled,
    hariSebelumJatuhTempo,
    selisihHari,
  }
}

/**
 * Update status pembayaran tagihan
 * 
 * Perbedaan REGULER vs NON_REGULER:
 * - REGULER: 
 *   * Jika bayar SEBELUM jatuh tempo → jatuh tempo tetap (tidak berubah)
 *   * Jika bayar SETELAH jatuh tempo → jatuh tempo tetap (mengikuti jadwal tetap)
 *   * Pelanggan kehilangan hari-hari masa tunggak jika terlambat
 * - NON_REGULER:
 *   * Jika bayar SEBELUM jatuh tempo → jatuh tempo tetap (tidak berubah)
 *   * Jika bayar SETELAH jatuh tempo → jatuh tempo bergeser dari tanggal pembayaran
 *   * Pelanggan tetap menikmati layanan penuh sesuai durasi paket
 */
export async function updateStatusPembayaran(
  tagihanId: string,
  metodePembayaran?: string,
  catatan?: string,
): Promise<void> {
  const tagihanRepo = getTagihanRepository()
  const tagihan = await tagihanRepo.findById(tagihanId)

  if (!tagihan) {
    throw new Error('Tagihan tidak ditemukan')
  }

  if (tagihan.status === 'LUNAS') {
    throw new Error('Tagihan sudah dibayar')
  }

  const tanggalBayar = new Date()
  const jatuhTempoTagihan = new Date(tagihan.jatuhTempo)

  // Update status tagihan
  await tagihanRepo.update(tagihanId, {
    status: TagihanStatus.LUNAS,
    tanggalBayar,
    metodePembayaran: metodePembayaran || null,
    catatan: catatan || null,
  })

  // Ambil data pelanggan untuk cek tipe
  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: tagihan.pelangganId },
    include: {
      hargaPaket: true,
    },
  })

  if (!pelanggan || !pelanggan.hargaPaket) {
    return // Tidak perlu update jatuh tempo jika pelanggan/paket tidak ditemukan
  }

  // Cek apakah pembayaran dilakukan setelah jatuh tempo
  const isTerlambat = tanggalBayar > jatuhTempoTagihan

  // Untuk NON_REGULER yang terlambat bayar: Update jatuh tempo dari tanggal pembayaran
  // Untuk REGULER atau NON_REGULER yang bayar tepat waktu: Jatuh tempo tetap (tidak diupdate)
  if (pelanggan.tipe === 'NON_REGULER' && isTerlambat) {
    const paket = pelanggan.hargaPaket
    const jatuhTempoBaru = new Date(tanggalBayar)

    // Hitung jatuh tempo baru dari tanggal pembayaran + durasi paket
    switch (paket.durasiUnit) {
      case 'JAM':
        jatuhTempoBaru.setHours(jatuhTempoBaru.getHours() + paket.durasi)
        break
      case 'HARI':
        jatuhTempoBaru.setDate(jatuhTempoBaru.getDate() + paket.durasi)
        break
      case 'BULAN':
        jatuhTempoBaru.setMonth(jatuhTempoBaru.getMonth() + paket.durasi)
        break
      case 'TAHUN':
        jatuhTempoBaru.setFullYear(jatuhTempoBaru.getFullYear() + paket.durasi)
        break
    }

    // Update jatuh tempo pelanggan
    await prisma.pelanggan.update({
      where: { id: pelanggan.id },
      data: {
        jatuhTempo: jatuhTempoBaru,
      },
    })
  }
  // Untuk REGULER atau NON_REGULER yang bayar tepat waktu: Jatuh tempo tetap tidak diupdate
}

/**
 * Update status tagihan terlambat (dipanggil oleh cron job)
 */
export async function updateStatusTagihanTerlambat(): Promise<number> {
  const tagihanRepo = getTagihanRepository()
  const tagihans = await tagihanRepo.findTerlambat()

  let updated = 0
  for (const tagihan of tagihans) {
    if (tagihan.status !== TagihanStatus.TERLAMBAT) {
      await tagihanRepo.update(tagihan.id, {
        status: TagihanStatus.TERLAMBAT,
      })
      updated++
    }
  }

  return updated
}

interface RenewOptions {
  tipeLangganan?: 'SEKALI_BELI' | 'PERPANJANG'
  hargaPaketId?: string | null
  diskon?: number
}

/**
 * Renew/Perpanjang layanan pelanggan
 * 
 * Perbedaan REGULER vs NON_REGULER:
 * - REGULER: Jatuh tempo baru dihitung dari jatuh tempo saat ini (mengikuti jadwal tetap)
 *            Jika terlambat bayar, masa tunggak tidak dihitung sebagai layanan
 * - NON_REGULER: Jatuh tempo baru dihitung dari tanggal pembayaran terakhir
 *                 Pelanggan tetap menikmati layanan penuh sesuai durasi paket
 * 
 * Mode Tipe Langganan:
 * - SEKALI_BELI: Aktif dari sekarang, abaikan tunggakan sebelumnya
 * - PERPANJANG: Lanjutkan dari jatuh tempo (default)
 */
export async function renewPelanggan(
  pelangganId: string,
  options?: RenewOptions,
): Promise<{
  tagihanId: string
  jatuhTempoBaru: Date
}> {
  let pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    include: {
      hargaPaket: true,
    },
  })

  if (!pelanggan) {
    throw new Error('Pelanggan tidak ditemukan')
  }

  // Ubah paket jika ada opsi hargaPaketId
  if (options?.hargaPaketId && options.hargaPaketId !== pelanggan.hargaPaketId) {
    await prisma.pelanggan.update({
      where: { id: pelangganId },
      data: {
        hargaPaketId: options.hargaPaketId,
      },
    })

    // Reload pelanggan dengan paket baru
    pelanggan = await prisma.pelanggan.findUnique({
      where: { id: pelangganId },
      include: {
        hargaPaket: true,
      },
    })

    if (!pelanggan) {
      throw new Error('Pelanggan tidak ditemukan')
    }
  }

  if (!pelanggan.hargaPaket) {
    throw new Error('Paket pelanggan tidak ditemukan')
  }

  const paket = pelanggan.hargaPaket
  let jatuhTempoBaru: Date

  // Tentukan titik awal perhitungan jatuh tempo baru
  // Jika mode SEKALI_BELI, mulai dari sekarang (abaikan tunggakan)
  if (options?.tipeLangganan === 'SEKALI_BELI') {
    jatuhTempoBaru = new Date()
  } else if (pelanggan.tipe === 'REGULER') {
    // REGULER: Hitung dari jatuh tempo saat ini (mengikuti jadwal tetap)
    const jatuhTempoSaatIni = new Date(pelanggan.jatuhTempo)
    jatuhTempoBaru = new Date(jatuhTempoSaatIni)

    // Tambahkan durasi berdasarkan unit
    switch (paket.durasiUnit) {
      case 'JAM':
        jatuhTempoBaru.setHours(jatuhTempoBaru.getHours() + paket.durasi)
        break
      case 'HARI':
        jatuhTempoBaru.setDate(jatuhTempoBaru.getDate() + paket.durasi)
        break
      case 'BULAN':
        jatuhTempoBaru.setMonth(jatuhTempoBaru.getMonth() + paket.durasi)
        break
      case 'TAHUN':
        jatuhTempoBaru.setFullYear(jatuhTempoBaru.getFullYear() + paket.durasi)
        break
    }
  } else {
    // NON_REGULER: Hitung dari tanggal pembayaran terakhir (jika ada) atau jatuh tempo saat ini
    // Cari tagihan terakhir yang sudah dibayar
    const tagihanRepo = getTagihanRepository()
    const tagihansLunas = await tagihanRepo.findByPelangganId(pelangganId)
    const tagihanTerakhirLunas = tagihansLunas
      .filter((t) => t.status === 'LUNAS' && t.tanggalBayar)
      .sort((a, b) => {
        const dateA = a.tanggalBayar ? new Date(a.tanggalBayar).getTime() : 0
        const dateB = b.tanggalBayar ? new Date(b.tanggalBayar).getTime() : 0
        return dateB - dateA
      })[0]

    if (tagihanTerakhirLunas && tagihanTerakhirLunas.tanggalBayar) {
      // Gunakan tanggal pembayaran terakhir sebagai titik awal
      jatuhTempoBaru = new Date(tagihanTerakhirLunas.tanggalBayar)
    } else {
      // Jika belum ada tagihan yang dibayar, gunakan jatuh tempo saat ini
      jatuhTempoBaru = new Date(pelanggan.jatuhTempo)
    }

    // Tambahkan durasi berdasarkan unit
    switch (paket.durasiUnit) {
      case 'JAM':
        jatuhTempoBaru.setHours(jatuhTempoBaru.getHours() + paket.durasi)
        break
      case 'HARI':
        jatuhTempoBaru.setDate(jatuhTempoBaru.getDate() + paket.durasi)
        break
      case 'BULAN':
        jatuhTempoBaru.setMonth(jatuhTempoBaru.getMonth() + paket.durasi)
        break
      case 'TAHUN':
        jatuhTempoBaru.setFullYear(jatuhTempoBaru.getFullYear() + paket.durasi)
        break
    }
  }

  // Tentukan periode tagihan berdasarkan durasi paket
  let periodeBulan: number
  let periodeTahun: number

  if (paket.durasiUnit === 'BULAN' || paket.durasiUnit === 'TAHUN') {
    // Untuk paket bulanan/tahunan, gunakan periode bulan/tahun dari jatuh tempo baru
    periodeBulan = jatuhTempoBaru.getMonth() + 1
    periodeTahun = jatuhTempoBaru.getFullYear()
  } else {
    // Untuk paket harian/jam-jaman, gunakan periode bulan/tahun dari jatuh tempo baru
    periodeBulan = jatuhTempoBaru.getMonth() + 1
    periodeTahun = jatuhTempoBaru.getFullYear()
  }

  // Cek apakah tagihan untuk periode ini sudah ada
  const tagihanRepo = getTagihanRepository()
  const existingTagihan = await tagihanRepo.findByPelangganAndPeriode(
    pelangganId,
    periodeBulan,
    periodeTahun,
  )

  let tagihanResult: { id: string }

  if (existingTagihan) {
    // Jika tagihan sudah ada, gunakan tagihan yang sudah ada
    tagihanResult = { id: existingTagihan.id }
  } else {
    // Generate tagihan baru untuk periode yang sesuai
    tagihanResult = await generateTagihan(
      pelangganId,
      periodeBulan,
      periodeTahun,
    )
  }

  // Update jatuh tempo tagihan yang baru dibuat agar sesuai dengan durasi paket
  if (!existingTagihan) {
    await tagihanRepo.update(tagihanResult.id, {
      jatuhTempo: jatuhTempoBaru,
    })

    // Apply diskon jika ada (untuk admin renewal manual)
    if (options?.diskon && options.diskon > 0) {
      const tagihanDetail = await tagihanRepo.findById(tagihanResult.id)
      if (tagihanDetail) {
        // Hitung subtotal keseluruhan (paket + biaya tambahan)
        const subtotalKeseluruhanLama = tagihanDetail.subtotal + tagihanDetail.biayaInstalasi + tagihanDetail.biayaSewaPerangkat + tagihanDetail.biayaLainnya
        
        // Apply diskon ke subtotal paket
        const diskonAmount = Math.min(options.diskon, tagihanDetail.subtotal)
        const subtotalPaketBaru = tagihanDetail.subtotal - diskonAmount
        
        // Hitung subtotal keseluruhan baru (paket setelah diskon + biaya tambahan)
        const subtotalKeseluruhanBaru = subtotalPaketBaru + tagihanDetail.biayaInstalasi + tagihanDetail.biayaSewaPerangkat + tagihanDetail.biayaLainnya
        
        // Hitung PPN dari subtotal keseluruhan baru
        const pelanggan = await prisma.pelanggan.findUnique({
          where: { id: pelangganId },
          include: { hargaPaket: true },
        })
        
        let ppnBaru = 0
        if (pelanggan?.usePPN && pelanggan.hargaPaket?.usePPN && pelanggan.hargaPaket.ppnPercentage) {
          ppnBaru = Math.round((subtotalKeseluruhanBaru * pelanggan.hargaPaket.ppnPercentage) / 100)
        }
        
        // Total = subtotal keseluruhan + ppn
        const totalBaru = subtotalKeseluruhanBaru + ppnBaru

        await tagihanRepo.update(tagihanResult.id, {
          diskon: Math.round(diskonAmount),
          subtotal: Math.round(subtotalPaketBaru),
          ppn: ppnBaru,
          total: Math.round(totalBaru),
        })
      }
    }
  }

  // Update jatuh tempo pelanggan
  await prisma.pelanggan.update({
    where: { id: pelangganId },
    data: {
      jatuhTempo: jatuhTempoBaru,
    },
  })

  return {
    tagihanId: tagihanResult.id,
    jatuhTempoBaru,
  }
}

/**
 * Recalculate tagihan yang sudah ada dengan perhitungan terbaru
 * Berguna untuk memperbaiki tagihan yang dibuat dengan logika perhitungan lama
 */
export async function recalculateTagihan(tagihanId: string): Promise<void> {
  const tagihanRepo = getTagihanRepository()
  const tagihan = await tagihanRepo.findById(tagihanId)

  if (!tagihan) {
    throw new Error('Tagihan tidak ditemukan')
  }

  // Jika tagihan sudah lunas, jangan recalculate
  if (tagihan.status === 'LUNAS') {
    throw new Error('Tagihan yang sudah lunas tidak dapat di-recalculate')
  }

  // Hitung ulang tagihan dengan perhitungan terbaru
  const perhitungan = await hitungTagihan(tagihan.pelangganId, tagihan.periodeBulan, tagihan.periodeTahun)

  // Update tagihan dengan perhitungan baru
  await tagihanRepo.update(tagihanId, {
    subtotal: perhitungan.subtotal,
    diskon: perhitungan.diskon,
    ppn: perhitungan.ppn,
    biayaInstalasi: perhitungan.biayaInstalasi,
    biayaSewaPerangkat: perhitungan.biayaSewaPerangkat,
    biayaLainnya: perhitungan.biayaLainnya,
    total: perhitungan.total,
  })
}

/**
 * Recalculate semua tagihan yang belum lunas
 * Berguna untuk memperbaiki semua tagihan yang dibuat dengan logika perhitungan lama
 */
export async function recalculateAllUnpaidTagihan(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  const tagihanRepo = getTagihanRepository()
  
  // Ambil semua tagihan yang belum lunas
  const tagihanBelumLunas = await tagihanRepo.findByStatus(TagihanStatus.BELUM_LUNAS)
  const tagihanTerlambat = await tagihanRepo.findByStatus(TagihanStatus.TERLAMBAT)
  const semuaTagihan = [...tagihanBelumLunas, ...tagihanTerlambat]

  let success = 0
  let failed = 0
  const errors: string[] = []

  for (const tagihan of semuaTagihan) {
    try {
      await recalculateTagihan(tagihan.id)
      success++
    } catch (error: any) {
      failed++
      errors.push(`Tagihan ${tagihan.noTagihan}: ${error.message}`)
    }
  }

  return { success, failed, errors }
}

