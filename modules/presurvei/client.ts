/**
 * Public API modul presurvei untuk komponen klien.
 *
 * Hanya berisi tipe, konstanta, schema Zod, dan fungsi murni — TIDAK
 * meng-export service atau repository, sehingga aman diimpor dari client
 * component tanpa menarik Prisma/pg/tls ke bundle browser.
 *
 * Client component: `import { ... } from "@/modules/presurvei/client"`
 * Server/API route: `import { ... } from "@/modules/presurvei"` (barrel penuh)
 */

export {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  type KegiatanHasil,
  type KegiatanJenis,
} from "./domain/entities/Kegiatan";

export {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
  type ProspekStatus,
  type ProspekSumber,
} from "./domain/entities/Prospek";

export { IKLAN_CHANNELS, type IklanChannel } from "./domain/entities/Iklan";

export {
  BULAN_MAKS,
  BULAN_MIN,
  type PeriodeTarget,
} from "./domain/entities/Target";

export {
  getStatusLanjutan,
  isStatusFinal,
  isSumberButuhIklan,
  isSumberButuhReferral,
} from "./domain/prospek-rules";

export { resolveAksiKanban, type AksiKanban } from "./domain/prospek-kanban";

export {
  daftarHasilSekelompok,
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
} from "./domain/kegiatan-rules";

export {
  hitungPerubahanKegiatan,
  isTanpaPerubahan,
  nilaiBaruDariPerubahan,
  type MedanKegiatanDapatDiubah,
  type NilaiKegiatanDapatDiubah,
  type PerubahanKegiatan,
  type UbahKegiatanInput,
} from "./domain/kegiatan-perubahan";

export { isIklanBerjalan } from "./domain/iklan-rules";

export {
  catatKegiatanSchema,
  daftarKegiatanSchema,
  TOLERANSI_SKEW_JAM_MENIT,
  ubahKegiatanSchema,
} from "./validators/kegiatan.validator";

export {
  buatProspekSchema,
  daftarProspekSchema,
  ubahProspekSchema,
} from "./validators/prospek.validator";

export {
  jadikanCanvasingSchema,
  type JadikanCanvasingInput,
} from "./validators/konversi.validator";

export {
  buatIklanSchema,
  daftarIklanSchema,
  ubahIklanSchema,
} from "./validators/iklan.validator";

export {
  laporanPeriodeSchema,
  tetapkanTargetSchema,
} from "./validators/target.validator";

export type {
  KegiatanDetailDto,
  KegiatanListItemDto,
  KegiatanRincianDto,
  RiwayatKegiatanDto,
} from "./dto/kegiatan.dto";
export type { ProspekDetailDto, ProspekListItemDto } from "./dto/prospek.dto";
export type { IklanDetailDto, IklanListItemDto } from "./dto/iklan.dto";
export type { BarisLaporanDto, TargetDto } from "./dto/target.dto";
export type { SalesPresurveiDto } from "./dto/sales.dto";

export {
  IKLAN_CHANNEL_CONFIG,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
  daftarKolomHidup,
  daftarKolomMati,
  type TampilanStatus,
} from "./utils/statusConfig";
