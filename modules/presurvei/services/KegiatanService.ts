import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { RiwayatKegiatanEntity } from "../domain/entities/KegiatanRiwayat";
import type { ProspekEntity, ProspekSumber } from "../domain/entities/Prospek";
import {
  hitungPerubahanKegiatan,
  isTanpaPerubahan,
  nilaiBaruDariPerubahan,
  type MedanKegiatanDapatDiubah,
  type UbahKegiatanInput,
} from "../domain/kegiatan-perubahan";
import {
  isButuhLokasi,
  isHasilMelahirkanProspek,
  isPerubahanHasilSah,
} from "../domain/kegiatan-rules";
import type {
  CreateKegiatanInput,
  IKegiatanRepository,
  KegiatanListFilters,
} from "../domain/ports/IKegiatanRepository";
import type { CreateProspekInput } from "../domain/ports/IProspekRepository";
import { KegiatanRepository } from "../repositories/KegiatanRepository";

/** Data minimal untuk melahirkan prospek dari sebuah kegiatan. */
export interface DataProspekBaru {
  nama: string;
  noTelp: string;
  alamat: string;
  email?: string | null;
  paketDiminati?: string | null;
}

export type CatatKegiatanInput = CreateKegiatanInput & {
  prospekBaru?: DataProspekBaru;
};

/** Hasil pencatatan kegiatan: prospek terisi hanya bila kegiatan melahirkan satu. */
export interface HasilCatatKegiatan {
  kegiatan: KegiatanEntity;
  prospek: ProspekEntity | null;
}

/** Kegiatan beserta jejak audit perubahannya, untuk halaman rincian. */
export interface RincianKegiatan {
  kegiatan: KegiatanEntity;
  riwayat: RiwayatKegiatanEntity[];
}

/** Siapa yang mengubah, dan (bila terikat) pemilik yang wajib cocok. */
export interface KonteksPengubah {
  idPengubah: string;
  /** Sama artinya dengan `pemilikWajib` pada `detail`. */
  pemilikWajib?: string;
}

/** Muatan pengumuman perubahan kegiatan, tanpa nilai lama/baru. */
export interface MuatanKegiatanDiubah {
  kegiatanId: string;
  pelakuId: string;
  diubahOlehId: string;
  medanBerubah: MedanKegiatanDapatDiubah[];
  tenantId: string | null;
}

/** Mengumumkan perubahan kegiatan yang sudah tersimpan. */
export type PengumumPerubahanKegiatan = (
  muatan: MuatanKegiatanDiubah,
) => Promise<void>;

const NAMA_EVENT_KEGIATAN_DIUBAH = "presurvei:kegiatan.updated";

const PESAN_HASIL_LINTAS_KELOMPOK =
  "Hasil ini mengubah apakah kegiatan melahirkan prospek; catat kegiatan baru.";

const PESAN_KEGIATAN_BERUBAH =
  "Kegiatan ini baru saja diubah orang lain. Muat ulang lalu coba lagi.";

/** Pengumum bawaan: event bus, diimpor dinamis seperti `ProspekKonversiService`. */
const umumkanLewatEventBus: PengumumPerubahanKegiatan = async (muatan) => {
  const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
  await eventBus.publish(EVENT_NAMES.PRESURVEI_KEGIATAN_UPDATED, {
    kegiatanId: muatan.kegiatanId,
    pelakuId: muatan.pelakuId,
    diubahOlehId: muatan.diubahOlehId,
    medanBerubah: muatan.medanBerubah,
    triggeredBy: muatan.diubahOlehId,
    tenantId: muatan.tenantId ?? undefined,
  });
};

// Satu-satunya sumber yang boleh dibubuhkan otomatis. Kegiatan lapangan adalah
// satu-satunya jenis yang memang berarti "sales menemui calon pelanggan di
// lokasi", jadi tidak ada penurunan yang perlu ditebak.
const SUMBER_PROSPEK_OTOMATIS: ProspekSumber = "LAPANGAN";

/**
 * Orkestrasi kegiatan presurvei.
 *
 * Kegiatan yang membuahkan minat dan membawa data calon pelanggan langsung
 * melahirkan prospek, supaya sales tidak perlu mengetik ulang data yang sama.
 */
export class KegiatanService {
  constructor(
    private readonly repository: IKegiatanRepository = new KegiatanRepository(),
    private readonly umumkanPerubahan: PengumumPerubahanKegiatan = umumkanLewatEventBus,
  ) {}

  /** Ambil satu halaman kegiatan sesuai filter. */
  async daftar(
    filters: KegiatanListFilters,
  ): Promise<{ items: KegiatanEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /**
   * Ambil satu kegiatan, melempar 404 bila tidak ada.
   *
   * `pemilikWajib` diisi route untuk pemanggil yang hanya boleh melihat
   * kegiatannya sendiri — sales lapangan memegang `m_presurvei:read` tanpa
   * `presurvei:read`, sehingga tanpa pengikat ini ia bisa membaca laporan
   * kunjungan seluruh tenant. Identitas pemanggil diturunkan dari sesi di
   * controller; keputusan menolaknya tinggal di sini.
   */
  async detail(id: string, pemilikWajib?: string): Promise<KegiatanEntity> {
    const kegiatan = await this.repository.findById(id);
    if (!kegiatan) {
      throw new AppError("Kegiatan tidak ditemukan", 404, "NOT_FOUND");
    }
    if (pemilikWajib && kegiatan.userId !== pemilikWajib) {
      throw new AppError("Kegiatan ini milik sales lain", 403, "FORBIDDEN");
    }
    return kegiatan;
  }

  /** Kegiatan beserta riwayat perubahannya, dengan aturan kepemilikan `detail`. */
  async rincian(id: string, pemilikWajib?: string): Promise<RincianKegiatan> {
    const kegiatan = await this.detail(id, pemilikWajib);
    return { kegiatan, riwayat: await this.repository.findRiwayat(id) };
  }

  /**
   * Ubah catatan, nama yang ditemui, atau hasil kegiatan, dengan jejak audit.
   *
   * Hanya medan yang benar-benar berubah yang ditulis dan dicatat; masukan
   * tanpa perubahan nyata tidak menulis apa pun. Hasil tidak boleh melintasi
   * batas `isHasilMelahirkanProspek` (`isPerubahanHasilSah`). Tidak ada batas
   * waktu: medan yang bisa diubah tidak menggeser angka laporan pencapaian
   * (`KegiatanRepository.hitungPerUser` berkunci `userId` dan `waktuMulai`),
   * dan jejak audit memberi akuntabilitasnya.
   */
  async ubah(
    id: string,
    input: UbahKegiatanInput,
    konteks: KonteksPengubah,
  ): Promise<RincianKegiatan> {
    const kegiatan = await this.detail(id, konteks.pemilikWajib);

    if (
      input.hasil !== undefined &&
      !isPerubahanHasilSah(kegiatan.hasil, input.hasil)
    ) {
      throw new AppError(PESAN_HASIL_LINTAS_KELOMPOK, 400, "VALIDATION_ERROR");
    }

    const perubahan = hitungPerubahanKegiatan(kegiatan, input);
    if (isTanpaPerubahan(perubahan)) {
      return { kegiatan, riwayat: await this.repository.findRiwayat(id) };
    }

    const diperbarui = await this.repository.ubahDenganRiwayat({
      id,
      versi: kegiatan.updatedAt,
      nilaiBaru: nilaiBaruDariPerubahan(perubahan),
      riwayat: {
        tenantId: kegiatan.tenantId,
        diubahOlehId: konteks.idPengubah,
        perubahan,
      },
    });
    if (!diperbarui) {
      throw new AppError(PESAN_KEGIATAN_BERUBAH, 409, "CONFLICT");
    }

    this.umumkanTanpaMenggagalkan({
      kegiatanId: id,
      pelakuId: kegiatan.userId,
      diubahOlehId: konteks.idPengubah,
      medanBerubah: Object.keys(perubahan) as MedanKegiatanDapatDiubah[],
      tenantId: kegiatan.tenantId,
    });

    return {
      kegiatan: diperbarui,
      riwayat: await this.repository.findRiwayat(id),
    };
  }

  /**
   * Perubahannya sudah tersimpan; kegagalan mengumumkan tidak boleh
   * membatalkannya, tapi wajib berjejak (pola `ProspekKonversiService.umumkanKonversi`).
   */
  private umumkanTanpaMenggagalkan(muatan: MuatanKegiatanDiubah): void {
    this.umumkanPerubahan(muatan).catch((error: unknown) => {
      logger.error(
        `[KegiatanService] Gagal mempublikasikan ${NAMA_EVENT_KEGIATAN_DIUBAH}:`,
        error,
      );
    });
  }

  /**
   * Catat kegiatan, sekaligus melahirkan prospek bila layak.
   *
   * Prospek hanya dibuat saat hasilnya menunjukkan minat, kegiatan belum
   * menempel ke prospek lain, dan data calon pelanggan disertakan.
   *
   * Pembuatan otomatis sengaja dibatasi ke jenis kegiatan lapangan, karena
   * hanya untuk jenis itulah sumber prospeknya pasti `LAPANGAN` (spec §6.1).
   * Telepon, chat, dan iklan tetap tersimpan sebagai kegiatan dengan `prospek`
   * bernilai null: tidak ada nilai sumber yang tepat untuk menebaknya, dan
   * menebak salah berarti atribusi kampanye yang tidak bisa dibetulkan lagi.
   * Sales membuat prospeknya lewat `POST /api/presurvei/prospek` dengan
   * `sumber` eksplisit.
   */
  async catat(input: CatatKegiatanInput): Promise<HasilCatatKegiatan> {
    const { prospekBaru, ...kegiatan } = input;

    if (!prospekBaru || !this.isLayakMelahirkanProspek(input)) {
      return {
        kegiatan: await this.repository.create(kegiatan),
        prospek: null,
      };
    }

    const hasil = await this.repository.createDenganProspek(
      kegiatan,
      this.bangunProspek(input, prospekBaru),
    );

    return { kegiatan: hasil.kegiatan, prospek: hasil.prospek };
  }

  private isLayakMelahirkanProspek(input: CatatKegiatanInput): boolean {
    if (input.prospekId) return false;
    if (!isButuhLokasi(input.jenis)) return false;
    return isHasilMelahirkanProspek(input.hasil);
  }

  private bangunProspek(
    kegiatan: CatatKegiatanInput,
    data: DataProspekBaru,
  ): CreateProspekInput {
    return {
      nama: data.nama,
      noTelp: data.noTelp,
      alamat: data.alamat,
      email: data.email ?? null,
      paketDiminati: data.paketDiminati ?? null,
      latitude: kegiatan.latitude ?? null,
      longitude: kegiatan.longitude ?? null,
      sumber: SUMBER_PROSPEK_OTOMATIS,
      iklanId: kegiatan.iklanId ?? null,
      pemilikId: kegiatan.userId,
      siteId: kegiatan.siteId ?? null,
    };
  }
}
