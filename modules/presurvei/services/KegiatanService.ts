import { AppError } from "@/lib/errors";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { ProspekEntity, ProspekSumber } from "../domain/entities/Prospek";
import {
  isButuhLokasi,
  isHasilMelahirkanProspek,
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
