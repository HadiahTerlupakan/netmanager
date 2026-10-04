import { UserLookupService } from "@/modules/users";

/**
 * Pilihan karyawan untuk ditunjuk sebagai penanda tangan internal.
 *
 * Endpoint pemilih ini digerbang `pengesahan:create`, bukan `users:read`:
 * staf legal yang membuat surat tidak perlu hak mengelola pengguna, dan yang
 * dikembalikan hanya data yang dibutuhkan untuk memilih.
 */

const MAX_OPTIONS = 20;

export interface SignerOption {
  userId: string;
  name: string;
  /** Jabatan bawaan untuk dicetak di bawah tanda tangan: peran, atau departemen. */
  role: string | null;
  email: string;
  phone: string | null;
}

interface EmployeeDirectory {
  searchActiveEmployees(
    search: string,
    limit: number,
  ): Promise<
    Array<{
      id: string;
      name: string | null;
      email: string;
      phone: string | null;
      role: { name: string } | null;
      departments: { name: string } | null;
    }>
  >;
}

export class EndorsementSignerOptionsService {
  constructor(
    private readonly directory: EmployeeDirectory = new UserLookupService(),
  ) {}

  /** Cari karyawan aktif berdasarkan nama, email, atau telepon. */
  async search(keyword: string): Promise<SignerOption[]> {
    const employees = await this.directory.searchActiveEmployees(
      keyword,
      MAX_OPTIONS,
    );

    return employees.map((employee) => ({
      userId: employee.id,
      name: employee.name ?? employee.email,
      role: employee.role?.name ?? employee.departments?.name ?? null,
      email: employee.email,
      phone: employee.phone,
    }));
  }
}
