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
} from "./domain/kegiatan-rules";

export { isIklanBerjalan } from "./domain/iklan-rules";

export {
  catatKegiatanSchema,
  daftarKegiatanSchema,
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

export {
  KegiatanService,
  type CatatKegiatanInput,
  type DataProspekBaru,
  type HasilCatatKegiatan,
} from "./services/KegiatanService";

export { ProspekService } from "./services/ProspekService";

export { ProspekKonversiService } from "./services/ProspekKonversiService";

export { IklanService } from "./services/IklanService";

export { TargetService, type BarisLaporan } from "./services/TargetService";

export {
  toKegiatanDetail,
  toKegiatanListItem,
  type KegiatanDetailDto,
  type KegiatanListItemDto,
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

export { handleRegistrationCreatedPresurvei } from "./services/event-handlers/registration-created-presurvei.handler";

// NOTE: ProspekRepository dan KegiatanRepository sengaja TIDAK diekspor
// (detail implementasi internal).
// NOTE: prospek.mapper dan kegiatan.mapper sengaja TIDAK diekspor (internal).
// NOTE: IklanRepository dan iklan.mapper sengaja TIDAK diekspor (internal),
// konsisten dengan pola repository/mapper Fase 1 di atas.
