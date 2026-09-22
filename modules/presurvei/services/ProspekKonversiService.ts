import { AppError } from "@/lib/errors";
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

const KABEL_BAWAAN_METER = 0;
const JUMLAH_KEGIATAN_DIPERIKSA = 1;

/**
 * Promosi prospek yang sudah matang menjadi canvasing.
 *
 * Ini titik temu dua modul: presurvei memegang prospeknya, marketing memegang
 * canvasing beserta alur instalasinya. Canvasing dibuat lebih dulu, prospek
 * ditandai sesudahnya — bila urutannya dibalik dan pembuatan canvasing gagal,
 * prospek terlanjur tercatat terkonversi ke sesuatu yang tidak pernah ada.
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
    const canvasing = await this.buatCanvasing(
      this.bangunMasukanCanvasing(prospek, input, survei),
    );

    const diperbarui = await this.prospekRepository.update(prospekId, {
      canvasingId: canvasing.id,
      konversiAt: new Date(),
    });

    this.umumkanKonversi(diperbarui, canvasing.id);

    return { prospek: diperbarui, canvasingId: canvasing.id };
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
      kabel: input.kabel ?? survei?.estimasiKabelMeter ?? KABEL_BAWAAN_METER,
      odp: input.odp ?? survei?.odpTerdekat ?? null,
      sn: input.sn ?? null,
      foto: input.foto ?? survei?.fotoUrls[0] ?? null,
      fotoKtp: input.fotoKtp ?? null,
    };
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
      } catch {
        // Konversinya sudah tersimpan; kegagalan mengumumkan tidak boleh
        // membatalkannya. Laporan yang bersandar pada event ini akan tertinggal,
        // bukan salah.
      }
    })();
  }
}
