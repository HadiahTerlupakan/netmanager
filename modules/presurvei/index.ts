/**
 * Public API modul presurvei.
 *
 * Modul lain hanya boleh mengimpor dari berkas ini.
 */

export {
  KEGIATAN_HASIL,
  KEGIATAN_JENIS,
  type KegiatanEntity,
  type KegiatanHasil,
  type KegiatanJenis,
} from "./domain/entities/Kegiatan";

export {
  PROSPEK_STATUSES,
  PROSPEK_SUMBER,
  type ProspekEntity,
  type ProspekStatus,
  type ProspekSumber,
} from "./domain/entities/Prospek";

export {
  IKLAN_CHANNELS,
  type IklanChannel,
  type IklanEntity,
} from "./domain/entities/Iklan";

export {
  BULAN_MAKS,
  BULAN_MIN,
  type PeriodeTarget,
  type RealisasiTarget,
  type TargetEntity,
} from "./domain/entities/Target";

export {
  hitungPencapaian,
  type BarisPencapaian,
  type Pencapaian,
} from "./domain/target-rules";

export {
  canPromosikanKeCanvasing,
  daftarStatusBebanAktif,
  getStatusLanjutan,
  isStatusBebanAktif,
  isStatusFinal,
  isSumberButuhIklan,
  isSumberButuhReferral,
  isTransisiStatusSah,
} from "./domain/prospek-rules";

export {
  isButuhDataTeknis,
  isButuhIklan,
  isButuhLokasi,
  isHasilMelahirkanProspek,
  isPerubahanHasilSah,
} from "./domain/kegiatan-rules";

export {
  type MedanKegiatanDapatDiubah,
  type PerubahanKegiatan,
  type UbahKegiatanInput,
} from "./domain/kegiatan-perubahan";

export { type RiwayatKegiatanEntity } from "./domain/entities/KegiatanRiwayat";

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

export { daftarSalesPresurveiSchema } from "./validators/sales.validator";

export {
  KegiatanService,
  type CatatKegiatanInput,
  type DataProspekBaru,
  type HasilCatatKegiatan,
  type KonteksPengubah,
  type RincianKegiatan,
} from "./services/KegiatanService";

export { ProspekService } from "./services/ProspekService";

export { ProspekKonversiService } from "./services/ProspekKonversiService";

export { IklanService } from "./services/IklanService";

export { TargetService, type BarisLaporan } from "./services/TargetService";

export { SalesPresurveiService } from "./services/SalesPresurveiService";

export { DepartemenPresurveiService } from "./services/DepartemenPresurveiService";

export type { AksesTenantPresurvei } from "./domain/akses-tenant";

export {
  toKegiatanDetail,
  toKegiatanListItem,
  toKegiatanRincian,
  type KegiatanDetailDto,
  type KegiatanListItemDto,
  type KegiatanRincianDto,
  type RiwayatKegiatanDto,
} from "./dto/kegiatan.dto";

export {
  toProspekDetail,
  toProspekListItem,
  type ProspekDetailDto,
  type ProspekListItemDto,
} from "./dto/prospek.dto";

export {
  toIklanDetail,
  toIklanListItem,
  type IklanDetailDto,
  type IklanListItemDto,
} from "./dto/iklan.dto";

export {
  toBarisLaporanDto,
  toTargetDto,
  type BarisLaporanDto,
  type TargetDto,
} from "./dto/target.dto";

export { toSalesPresurveiDto, type SalesPresurveiDto } from "./dto/sales.dto";

export {
  toDepartemenPresurveiDto,
  type DepartemenPresurveiDto,
} from "./dto/departemen.dto";

export { PERAN_PELAKU, type PeranPelaku } from "./domain/peran-pelaku";

export { handleRegistrationCreatedPresurvei } from "./services/event-handlers/registration-created-presurvei.handler";

// NOTE: ProspekRepository dan KegiatanRepository sengaja TIDAK diekspor
// (detail implementasi internal).
// NOTE: prospek.mapper dan kegiatan.mapper sengaja TIDAK diekspor (internal).
// NOTE: SalesRepository dan DepartemenRepository sengaja TIDAK diekspor (internal).
// NOTE: IklanRepository dan iklan.mapper sengaja TIDAK diekspor (internal),
// konsisten dengan pola repository/mapper Fase 1 di atas.
