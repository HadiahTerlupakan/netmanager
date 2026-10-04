import { UserLookupService, type EmployeeOption } from "@/modules/users";

/**
 * Pilihan karyawan untuk ditunjuk sebagai penanda tangan internal.
 *
 * Endpoint pemilih ini digerbang `pengesahan:create`, bukan `users:read`:
 * staf legal yang membuat surat tidak perlu hak mengelola pengguna, dan yang
 * dikembalikan hanya data yang dibutuhkan untuk memilih.
 */

const MAX_OPTIONS = 20;

export type SignerOption = EmployeeOption;

interface EmployeeDirectory {
  searchEmployeeOptions(keyword: string, limit: number): Promise<EmployeeOption[]>;
}

export class EndorsementSignerOptionsService {
  constructor(
    private readonly directory: EmployeeDirectory = new UserLookupService(),
  ) {}

  /** Cari karyawan aktif berdasarkan nama, email, atau telepon. */
  search(keyword: string): Promise<SignerOption[]> {
    return this.directory.searchEmployeeOptions(keyword, MAX_OPTIONS);
  }
}
