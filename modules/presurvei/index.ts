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
  canPromosikanKeCanvasing,
  getStatusLanjutan,
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
  KegiatanService,
  type CatatKegiatanInput,
  type DataProspekBaru,
  type HasilCatatKegiatan,
} from "./services/KegiatanService";

export { ProspekService } from "./services/ProspekService";

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

export { handleRegistrationCreatedPresurvei } from "./services/event-handlers/registration-created-presurvei.handler";

// NOTE: ProspekRepository dan KegiatanRepository sengaja TIDAK diekspor
// (detail implementasi internal).
// NOTE: prospek.mapper dan kegiatan.mapper sengaja TIDAK diekspor (internal).
