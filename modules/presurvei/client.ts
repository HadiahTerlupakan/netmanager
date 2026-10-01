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
  PROSPEK_JENIS,
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
  type ProspekJenis,
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
  isProspekPerantara,
  isStatusFinal,
  isSumberButuhIklan,
  isSumberButuhReferral,
} from "./domain/prospek-rules";

export { resolveAksiKanban, type AksiKanban } from "./domain/prospek-kanban";

export {
  HASIL_PER_JENIS,
  isHasilSesuaiJenis,
  LABEL_HASIL_UMUM,
  labelHasilKegiatan,
} from "./domain/hasil-kegiatan";

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
export type { DepartemenPresurveiDto } from "./dto/departemen.dto";

export { PERAN_PELAKU, type PeranPelaku } from "./domain/peran-pelaku";

export {
  IKLAN_CHANNEL_CONFIG,
  KEGIATAN_HASIL_CONFIG,
  KEGIATAN_JENIS_CONFIG,
  tampilanHasilKegiatan,
  PROSPEK_JENIS_CONFIG,
  PROSPEK_STATUS_CONFIG,
  PROSPEK_SUMBER_CONFIG,
  PERAN_PELAKU_LABEL,
  daftarKolomHidup,
  daftarKolomMati,
  type TampilanStatus,
} from "./utils/statusConfig";

// --- Rencana kunjungan & penugasan (aman untuk klien) ---
export {
  ALAMAT_RENCANA_MAKS,
  ALASAN_BATAL_MAKS,
  ALASAN_BATAL_MIN,
  RENCANA_JENIS,
  RENCANA_STATUS_TAMPIL,
  RENCANA_SUMBER,
  TUJUAN_RENCANA_MAKS,
  type RencanaJenis,
  type RencanaStatusTampil,
  type RencanaSumber,
} from "./domain/entities/Rencana";
export {
  buatRencanaSchema,
  RENTANG_REKAP_HARI_MAKS,
} from "./validators/rencana.validator";
export type {
  BarisRekapRencanaDto,
  RencanaDto,
  RincianRencanaDto,
} from "./dto/rencana.dto";

// --- Peran sales (aman untuk klien & alur auth tanpa database) ---
export { isKepalaSalesDariIzin, isSalesEfektif } from "./domain/peran-sales";

// --- Penilaian kinerja (aman untuk klien) ---
export {
  BOBOT_PENILAIAN_KEPALA,
  BOBOT_PENILAIAN_SALES,
  PREDIKAT_PENILAIAN,
  tentukanPredikat,
  type Indikator,
  type PredikatPenilaian,
} from "./domain/penilaian-rules";
export type {
  HasilPenilaian,
  PenilaianKepala,
  PenilaianSales,
} from "./services/PenilaianService";
