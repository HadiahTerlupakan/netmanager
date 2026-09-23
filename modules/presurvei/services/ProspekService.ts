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
import { PenugasanSalesService } from "./PenugasanSalesService";

/** Pilihan tambahan saat membuat prospek. */
export interface OpsiBuatProspek {
  /** Lanjutkan meski ada prospek aktif dengan nomor telepon yang sama. */
  abaikanDuplikat?: boolean;
  /**
   * Diisi route bila `pemilikId` DITUGASKAN pemanggil, bukan jatuh ke dirinya
   * sendiri. Memicu validasi sales se-tenant dan penulisan tenant eksplisit.
   * `tenantSesi` null hanya untuk super admin tanpa tenant sesi.
   */
  penugasanPemilik?: { tenantSesi: string | null };
}

/** Penugasan pemilik selalu penugasan baru, jadi sales-nya wajib aktif. */
const SYARAT_PEMILIK_BARU = { isWajibAktif: true };

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
    private readonly penugasanSales: PenugasanSalesService = new PenugasanSalesService(),
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
    const data = await this.sertakanTenantPenugasan(input, opsi);

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

    return this.repository.create(data);
  }

  /**
   * Masukan apa adanya bila pemilik tidak ditugaskan; bila ditugaskan,
   * divalidasi lalu ditambah tenant baris eksplisit supaya prospek buatan
   * super admin tanpa tenant sesi tidak lahir dengan `tenantId` null.
   */
  private async sertakanTenantPenugasan(
    input: CreateProspekInput,
    opsi: OpsiBuatProspek,
  ): Promise<CreateProspekInput> {
    if (!opsi.penugasanPemilik || !input.pemilikId) return input;

    const penugasan = await this.penugasanSales.muatUntukBarisBaru(
      input.pemilikId,
      opsi.penugasanPemilik.tenantSesi,
    );
    const tenantBaris = this.penugasanSales.pastikanSah(
      penugasan,
      SYARAT_PEMILIK_BARU,
    );
    return { ...input, tenantId: tenantBaris };
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

    // Hanya pemilik yang BERGANTI ke seseorang yang divalidasi, terhadap
    // tenant baris prospek — bukan tenant sesi, yang bagi super admin bisa
    // berbeda. Melepas pemilik (null) dan mengirim ulang pemilik yang sama
    // tidak divalidasi, supaya prospek milik sales yang kini nonaktif tetap
    // bisa disunting.
    const isPemilikBerganti =
      input.pemilikId != null && input.pemilikId !== prospek.pemilikId;
    if (isPemilikBerganti) {
      const penugasan = await this.penugasanSales.muatUntukBaris(
        input.pemilikId,
        prospek.tenantId,
      );
      this.penugasanSales.pastikanSah(penugasan, SYARAT_PEMILIK_BARU);
    }

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
