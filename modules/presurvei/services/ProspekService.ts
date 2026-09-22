import { AppError } from "@/lib/errors";
import type { ProspekEntity, ProspekStatus } from "../domain/entities/Prospek";
import { isStatusFinal, isTransisiStatusSah } from "../domain/prospek-rules";
import type {
  CreateProspekInput,
  IProspekRepository,
  ProspekListFilters,
  UpdateProspekInput,
} from "../domain/ports/IProspekRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";

/** Pilihan tambahan saat membuat prospek. */
export interface OpsiBuatProspek {
  /** Lanjutkan meski ada prospek aktif dengan nomor telepon yang sama. */
  abaikanDuplikat?: boolean;
}

/** Ringkasan prospek duplikat yang dikembalikan bersama penolakan. */
interface RingkasanDuplikat {
  id: string;
  nama: string;
  status: ProspekStatus;
  pemilikId: string | null;
}

/**
 * Orkestrasi prospek presurvei.
 *
 * Menjaga agar perpindahan status hanya terjadi lewat jalur yang diizinkan
 * aturan funnel di domain, dan agar prospek milik sales lain tidak bisa dibaca
 * maupun diubah oleh sales yang hanya berhak atas miliknya sendiri.
 */
export class ProspekService {
  constructor(
    private readonly repository: IProspekRepository = new ProspekRepository(),
  ) {}

  /** Ambil satu halaman prospek sesuai filter. */
  async daftar(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }> {
    return this.repository.findMany(filters);
  }

  /**
   * Ambil satu prospek, melempar 404 bila tidak ada.
   *
   * `pemilikWajib` diisi route untuk pemanggil yang hanya boleh menyentuh
   * prospek miliknya sendiri — sales lapangan memegang `m_presurvei:read`
   * tanpa `presurvei:read`, sehingga tanpa pengikat ini ia bisa membaca
   * seluruh prospek tenant. Identitas pemanggil diturunkan dari sesi di
   * controller; keputusan menolaknya tinggal di sini supaya definisi "bukan
   * milikmu" tidak tersebar ke tiap route.
   */
  async detail(id: string, pemilikWajib?: string): Promise<ProspekEntity> {
    const prospek = await this.repository.findById(id);
    if (!prospek) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    this.pastikanBolehMenyentuh(prospek, pemilikWajib);
    return prospek;
  }

  /**
   * Simpan prospek baru, menolak duplikat nomor telepon kecuali diminta lain.
   *
   * Penolakannya membawa prospek yang bentrok supaya klien bisa menampilkannya
   * dan pemakai memutuskan sendiri — dua orang memang bisa berbagi nomor, dan
   * sales di lapangan tidak boleh terhalang oleh tebakan sistem.
   */
  async buat(
    input: CreateProspekInput,
    opsi: OpsiBuatProspek = {},
  ): Promise<ProspekEntity> {
    if (!opsi.abaikanDuplikat) {
      const duplikat = await this.cariDuplikatAktif(input.noTelp);
      if (duplikat.length > 0) {
        throw new AppError(
          "Sudah ada prospek aktif dengan nomor telepon ini",
          409,
          "DUPLIKAT",
          { duplikat },
        );
      }
    }

    return this.repository.create(input);
  }

  private async cariDuplikatAktif(
    noTelp: string,
  ): Promise<RingkasanDuplikat[]> {
    const sama = await this.repository.findByNoTelp(noTelp);
    return sama
      .filter((prospek) => !isStatusFinal(prospek.status))
      .map((prospek) => ({
        id: prospek.id,
        nama: prospek.nama,
        status: prospek.status,
        pemilikId: prospek.pemilikId,
      }));
  }

  /**
   * Perbarui prospek, menolak perpindahan status yang tidak sah.
   *
   * `pemilikWajib` punya arti yang sama seperti pada `detail`, dan di sini
   * mencegah sales mencuri prospek sales lain (`pemilikId` sendiri) atau
   * membunuhnya (`status: TIDAK_MINAT`).
   */
  async ubah(
    id: string,
    input: UpdateProspekInput,
    pemilikWajib?: string,
  ): Promise<ProspekEntity> {
    const prospek = await this.detail(id, pemilikWajib);

    if (input.status && input.status !== prospek.status) {
      if (!isTransisiStatusSah(prospek.status, input.status)) {
        throw new AppError(
          `Prospek berstatus ${prospek.status} tidak bisa langsung dipindah ke ${input.status}`,
          409,
          "INVALID_STATE",
        );
      }
    }

    return this.repository.update(id, input);
  }

  private pastikanBolehMenyentuh(
    prospek: ProspekEntity,
    pemilikWajib?: string,
  ): void {
    if (!pemilikWajib) return;
    if (prospek.pemilikId === pemilikWajib) return;
    throw new AppError("Prospek ini milik sales lain", 403, "FORBIDDEN");
  }
}
