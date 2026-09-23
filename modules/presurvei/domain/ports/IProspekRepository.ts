import type {
  ProspekEntity,
  ProspekStatus,
  ProspekSumber,
} from "../entities/Prospek";
import type { RentangPeriode } from "./IKegiatanRepository";

/**
 * Kontrak akses data prospek presurvei.
 *
 * Service hanya bergantung pada antarmuka ini supaya aturan bisnisnya bisa
 * diuji tanpa database.
 */

export interface ProspekListFilters {
  status?: ProspekStatus;
  sumber?: ProspekSumber;
  pemilikId?: string;
  /**
   * Hanya prospek tanpa pemilik. Kalah dari `pemilikId` yang terisi — lihat
   * `ProspekRepository.bangunFilter`.
   */
  tanpaPemilik?: boolean;
  search?: string;
  page: number;
  limit: number;
}

export interface CreateProspekInput {
  nama: string;
  noTelp: string;
  email?: string | null;
  alamat: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  sumber: ProspekSumber;
  iklanId?: string | null;
  registrationId?: string | null;
  referralNama?: string | null;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
  siteId?: string | null;
}

export interface UpdateProspekInput {
  nama?: string;
  noTelp?: string;
  email?: string | null;
  alamat?: string;
  latitude?: number | null;
  longitude?: number | null;
  shareloc?: string | null;
  status?: ProspekStatus;
  pemilikId?: string | null;
  paketDiminati?: string | null;
  catatan?: string | null;
  canvasingId?: string | null;
  konversiAt?: Date | null;
}

export interface IProspekRepository {
  findMany(
    filters: ProspekListFilters,
  ): Promise<{ items: ProspekEntity[]; total: number }>;
  findById(id: string): Promise<ProspekEntity | null>;
  /**
   * Prospek dengan nomor telepon yang sama — dipakai memperingatkan duplikat.
   *
   * Hasilnya dibatasi: yang dibutuhkan hanya beberapa contoh untuk ditampilkan,
   * dan nomor bersama seperti nomor kios bisa terpakai ratusan kali.
   */
  findByNoTelp(noTelp: string): Promise<ProspekEntity[]>;
  /** Prospek yang lahir dari satu pendaftaran publik, null bila belum ada. */
  findByRegistrationId(registrationId: string): Promise<ProspekEntity | null>;
  create(input: CreateProspekInput): Promise<ProspekEntity>;
  update(id: string, input: UpdateProspekInput): Promise<ProspekEntity>;
  /**
   * Tandai prospek sebagai terkonversi, hanya bila ia belum pernah ditandai.
   *
   * Mengembalikan null bila prospek sudah punya `canvasingId`. Pemanggil wajib
   * memperlakukan null sebagai kekalahan balapan — bukan kegagalan sistem —
   * dan membersihkan canvasing yang terlanjur ia buat.
   */
  tandaiKonversi(
    id: string,
    canvasingId: string,
  ): Promise<ProspekEntity | null>;
  /** Jumlah prospek baru per pemilik pada satu rentang, berkunci pemilikId. */
  hitungBaruPerUser(rentang: RentangPeriode): Promise<Record<string, number>>;
  /** Jumlah prospek terkonversi per pemilik pada satu rentang. */
  hitungKonversiPerUser(
    rentang: RentangPeriode,
  ): Promise<Record<string, number>>;
}
