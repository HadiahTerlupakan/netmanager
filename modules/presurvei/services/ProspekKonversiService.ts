import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { CreateCanvasingInput } from "@/modules/marketing";
import type { KegiatanEntity } from "../domain/entities/Kegiatan";
import type { ProspekEntity } from "../domain/entities/Prospek";
import { canPromosikanKeCanvasing } from "../domain/prospek-rules";
import type { IKegiatanRepository } from "../domain/ports/IKegiatanRepository";
import type { IProspekRepository } from "../domain/ports/IProspekRepository";
import { KegiatanRepository } from "../repositories/KegiatanRepository";
import { ProspekRepository } from "../repositories/ProspekRepository";
import type { JadikanCanvasingInput } from "../validators/konversi.validator";

/** Membuat canvasing dari data yang sudah lengkap. */
type PembuatCanvasing = (
  input: CreateCanvasingInput,
) => Promise<{ id: string }>;

/** Menghapus canvasing yang sudah terlanjur dibuat. */
type PenghapusCanvasing = (canvasingId: string) => Promise<void>;

const KABEL_BAWAAN_METER = 1;
/**
 * Kabel terpendek yang diterima canvasing
 * (`modules/marketing/validators/canvasingValidation.ts:62-65`). Survei
 * presurvei sendiri boleh mencatat 0 (`kegiatan.validator.ts`, `estimasiKabelMeter`).
 */
const KABEL_MINIMAL_CANVASING_METER = 1;
const JUMLAH_KEGIATAN_DIPERIKSA = 1;

/**
 * Promosi prospek yang sudah matang menjadi canvasing.
 *
 * Ini titik temu dua modul: presurvei memegang prospeknya, marketing memegang
 * canvasing beserta alur instalasinya. Canvasing dibuat lebih dulu, prospek
 * ditandai sesudahnya lewat penulisan bersyarat (`canvasingId: null` di
 * `where`, lihat `ProspekRepository.tandaiKonversi`) yang menjadikan
 * penandaan itu sendiri sebagai titik serialisasi — pemeriksaan
 * `canPromosikanKeCanvasing` berjalan sebelum canvasing dibuat, jadi dua
 * permintaan bersamaan bisa sama-sama melewatinya. Baik penandaan yang gagal
 * maupun yang kalah balapan membersihkan canvasing yang terlanjur dibuat,
 * supaya tidak ada baris canvasing yatim yang muncul di daftar admin tanpa
 * bisa ditautkan balik ke prospek mana pun.
 */
export class ProspekKonversiService {
  constructor(
    private readonly prospekRepository: IProspekRepository = new ProspekRepository(),
    private readonly kegiatanRepository: IKegiatanRepository = new KegiatanRepository(),
    private readonly buatCanvasing: PembuatCanvasing = async (input) => {
      const { createCanvasingService } = await import("@/modules/marketing");
      const hasil = await createCanvasingService().createRequest(input);
      return { id: hasil.id };
    },
    private readonly hapusCanvasing: PenghapusCanvasing = async (id) => {
      const { createCanvasingService } = await import("@/modules/marketing");
      await createCanvasingService().deleteRequest(id);
    },
  ) {}

  /**
   * Jadikan prospek sebagai canvasing, lalu tandai prospeknya.
   *
   * `pemilikWajib` diisi untuk pemanggil yang hanya boleh menyentuh datanya
   * sendiri; biarkan kosong untuk admin.
   */
  async jadikanCanvasing(
    prospekId: string,
    input: JadikanCanvasingInput,
    pemilikWajib?: string,
  ): Promise<{ prospek: ProspekEntity; canvasingId: string }> {
    const prospek = await this.ambilProspek(prospekId, pemilikWajib);

    if (!canPromosikanKeCanvasing(prospek)) {
      throw new AppError(
        prospek.canvasingId
          ? "Prospek ini sudah pernah dijadikan canvasing"
          : "Hanya prospek berstatus DEAL yang bisa dijadikan canvasing",
        409,
        "INVALID_STATE",
      );
    }

    const survei = await this.ambilSurveiTerbaru(prospekId);
    const masukan = await this.validasiMasukanCanvasing(
      this.bangunMasukanCanvasing(prospek, input, survei),
    );
    const canvasing = await this.buatCanvasing(masukan);

    let diperbarui: ProspekEntity | null;
    try {
      diperbarui = await this.prospekRepository.tandaiKonversi(
        prospekId,
        canvasing.id,
      );
    } catch (error) {
      await this.batalkanCanvasing(canvasing.id);
      throw error;
    }

    if (!diperbarui) {
      // Permintaan lain menang balapan. Canvasing yang baru saja kita buat
      // tidak akan pernah tertaut ke prospek mana pun, dan tidak ada kolom di
      // sisi canvasing yang bisa dipakai menemukannya lagi — jadi ia dihapus
      // sekarang, bukan ditinggalkan sebagai baris yatim yang tetap muncul di
      // daftar admin dan bisa di-approve menjadi work order.
      await this.batalkanCanvasing(canvasing.id);
      throw new AppError(
        "Prospek ini sudah pernah dijadikan canvasing",
        409,
        "INVALID_STATE",
      );
    }

    this.umumkanKonversi(diperbarui, canvasing.id);

    return { prospek: diperbarui, canvasingId: canvasing.id };
  }

  /** Hapus canvasing yang terlanjur dibuat saat penandaan prospek tidak jadi. */
  private async batalkanCanvasing(canvasingId: string): Promise<void> {
    await this.hapusCanvasing(canvasingId).catch((error: unknown) => {
      // Kegagalan kompensasi tidak boleh menutupi error aslinya (lihat
      // pemanggil, yang tetap melempar setelah ini) — tapi tanpa jejak ini,
      // yang tersisa persis canvasing yatim yang seluruh mekanisme ini
      // hendak bunuh, dan tak satu baris log pun menyebut id mana yang
      // perlu dibereskan manual.
      logger.error(
        `[ProspekKonversiService] Gagal menghapus canvasing kompensasi ${canvasingId}:`,
        error,
      );
    });
  }

  private async ambilProspek(
    prospekId: string,
    pemilikWajib?: string,
  ): Promise<ProspekEntity> {
    const prospek = await this.prospekRepository.findById(prospekId);
    if (!prospek) {
      throw new AppError("Prospek tidak ditemukan", 404, "NOT_FOUND");
    }
    if (pemilikWajib && prospek.pemilikId !== pemilikWajib) {
      throw new AppError("Prospek ini milik sales lain", 403, "FORBIDDEN");
    }
    return prospek;
  }

  private async ambilSurveiTerbaru(
    prospekId: string,
  ): Promise<KegiatanEntity | null> {
    const hasil = await this.kegiatanRepository.findMany({
      prospekId,
      jenis: "SURVEI_LOKASI",
      page: 1,
      limit: JUMLAH_KEGIATAN_DIPERIKSA,
    });
    return hasil.items[0] ?? null;
  }

  private bangunMasukanCanvasing(
    prospek: ProspekEntity,
    input: JadikanCanvasingInput,
    survei: KegiatanEntity | null,
  ): CreateCanvasingInput {
    return {
      nama: prospek.nama,
      noTelpon: prospek.noTelp,
      email: prospek.email,
      alamat: prospek.alamat,
      latitude: prospek.latitude,
      longitude: prospek.longitude,
      shareloc: prospek.shareloc,
      salesId: prospek.pemilikId,
      noKtp: input.noKtp,
      paket: input.paket,
      kabel: input.kabel ?? estimasiKabelSurvei(survei) ?? KABEL_BAWAAN_METER,
      odp: input.odp ?? survei?.odpTerdekat ?? null,
      sn: input.sn ?? null,
      foto: input.foto ?? survei?.fotoUrls[0] ?? null,
      fotoKtp: input.fotoKtp ?? null,
    };
  }

  /**
   * Lewatkan calon masukan lewat validator marketing sebelum dipakai membuat
   * canvasing — jalur konversi ini satu-satunya yang selama ini melewatinya,
   * jadi invarian seperti kabel minimal 1 meter tidak boleh diam-diam
   * terlewati di sini. `ZodError` dibungkus jadi `AppError` 400 supaya
   * pemanggil menerima pesan yang wajar dan detail internal Zod tidak bocor.
   */
  private async validasiMasukanCanvasing(
    calon: CreateCanvasingInput,
  ): Promise<CreateCanvasingInput> {
    const { parseCreateCanvasingInput, getCanvasingValidationMessage } =
      await import("@/modules/marketing");
    try {
      return parseCreateCanvasingInput(calon);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(
          getCanvasingValidationMessage(error),
          400,
          "VALIDATION_ERROR",
        );
      }
      throw error;
    }
  }

  private umumkanKonversi(prospek: ProspekEntity, canvasingId: string): void {
    void (async () => {
      try {
        const { eventBus, EVENT_NAMES } = await import("@/lib/event-bus");
        await eventBus.publish(EVENT_NAMES.PRESURVEI_PROSPEK_CONVERTED, {
          prospekId: prospek.id,
          canvasingId,
          pemilikId: prospek.pemilikId,
          sumber: prospek.sumber,
          iklanId: prospek.iklanId,
          konversiAt: (prospek.konversiAt ?? new Date()).toISOString(),
          tenantId: prospek.tenantId ?? undefined,
        });
      } catch (error) {
        // Konversinya sudah tersimpan; kegagalan mengumumkan tidak boleh
        // membatalkannya. Laporan yang bersandar pada event ini akan tertinggal,
        // bukan salah — tapi kegagalannya tetap wajib berjejak.
        logger.error(
          "[ProspekKonversiService] Gagal mempublikasikan event konversi prospek:",
          error,
        );
      }
    })();
  }
}

/**
 * Estimasi kabel survei yang layak dipakai canvasing, atau null.
 *
 * Survei boleh mencatat 0 meter, sedangkan canvasing menuntut minimal 1. Nilai
 * di bawah minimum diperlakukan sama dengan survei yang tidak mencatat kabel —
 * jatuh ke `KABEL_BAWAAN_METER` — bukan diteruskan untuk ditolak: layar admin
 * mengirim `PATCH` ke DEAL lebih dulu lalu baru `POST` konversi
 * (`app/admin/presurvei/prospek/useJadikanCanvasing.ts:97-114`), jadi
 * penolakan itu datang setelah statusnya terlanjur berubah, dan pemakai tidak
 * pernah mengetik angka 0 itu sendiri. Kabel 0 yang DIKIRIM
 * pemanggil tidak melewati fungsi ini dan tetap ditolak terang-terangan.
 */
function estimasiKabelSurvei(survei: KegiatanEntity | null): number | null {
  const estimasi = survei?.estimasiKabelMeter ?? null;
  if (estimasi === null) return null;
  return estimasi >= KABEL_MINIMAL_CANVASING_METER ? estimasi : null;
}
