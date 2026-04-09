import { hash } from "bcryptjs";

import { InvestorRepository } from "../repositories/InvestorRepository";

const UNIQUE_CONSTRAINT_MESSAGE = "Username sudah digunakan";
const EMAIL_CONSTRAINT_MESSAGE = "Email sudah digunakan";
const RELATION_CONSTRAINT_MESSAGE =
  "Gagal menghapus investor karena masih terkait dengan Proyek RAB atau riwayat Payout. Silakan Nonaktifkan akun saja.";
const NOT_FOUND_MESSAGE = "Investor tidak ditemukan";
const UPDATE_ERROR_MESSAGE = "Gagal memperbarui investor";
const TOGGLE_ERROR_MESSAGE = "Gagal memperbarui status investor";
const DELETE_ERROR_MESSAGE = "Gagal menghapus investor";

export type SafeInvestor = {
  id: string;
  username: string;
  namaLengkap: string;
  perusahaan: string | null;
  email: string;
  noTelp: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type InvestorCreateInput = {
  username: string;
  password?: string;
  namaLengkap: string;
  perusahaan?: string | null;
  email: string;
  noTelp?: string | null;
  tenantId?: string;
};

export type InvestorUpdateInput = {
  username?: string;
  password?: string;
  namaLengkap?: string;
  perusahaan?: string | null;
  email?: string;
  noTelp?: string | null;
};

export type ServiceResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
  code?:
    | "NOT_FOUND"
    | "BAD_REQUEST"
    | "FETCH_ERROR"
    | "CREATE_ERROR"
    | "UPDATE_ERROR"
    | "DELETE_ERROR";
};

function toSafeInvestor<T extends { passwordHash?: string | null }>(
  investor: T,
): Omit<T, "passwordHash"> {
  const { passwordHash: _passwordHash, ...safeInvestor } = investor;
  return safeInvestor;
}

export class InvestorAdminService {
  constructor(private readonly repository = new InvestorRepository()) {}

  async getInvestors(): Promise<
    ServiceResult<Array<SafeInvestor & { _count?: { rabProjects: number } }>>
  > {
    try {
      const investors = await this.repository.findAll();
      return { success: true, data: investors.map(toSafeInvestor) };
    } catch {
      return {
        success: false,
        error: "Gagal mengambil daftar investor",
        code: "FETCH_ERROR",
      };
    }
  }

  async createInvestor(
    body: InvestorCreateInput,
  ): Promise<ServiceResult<SafeInvestor>> {
    try {
      if (!body.password) {
        return {
          success: false,
          error: "Password wajib diisi untuk membuat investor baru",
          code: "BAD_REQUEST",
        };
      }

      const existingInvestor = await this.repository.findByUsername(
        body.username,
      );
      if (existingInvestor) {
        return {
          success: false,
          error: UNIQUE_CONSTRAINT_MESSAGE,
          code: "BAD_REQUEST",
        };
      }

      const passwordHash = await hash(body.password, 12);
      const investor = await this.repository.create({
        username: body.username,
        passwordHash,
        namaLengkap: body.namaLengkap,
        perusahaan: body.perusahaan,
        noTelp: body.noTelp,
        email: body.email,
        ...(body.tenantId
          ? { tenant: { connect: { id: body.tenantId } } }
          : {}),
        isActive: true,
      });

      return { success: true, data: toSafeInvestor(investor) };
    } catch {
      return {
        success: false,
        error: "Gagal membuat investor",
        code: "CREATE_ERROR",
      };
    }
  }

  async getInvestorById(id: string): Promise<SafeInvestor | null> {
    const investor = await this.repository.findById(id);
    if (!investor) return null;
    return toSafeInvestor(investor);
  }

  async updateInvestorById(
    id: string,
    body: InvestorUpdateInput,
  ): Promise<ServiceResult<SafeInvestor>> {
    try {
      const existingInvestor = await this.repository.findById(id);

      if (!existingInvestor) {
        return { success: false, error: NOT_FOUND_MESSAGE, code: "NOT_FOUND" };
      }

      if (body.username && body.username !== existingInvestor.username) {
        const checkUsername = await this.repository.findByUsername(
          body.username,
        );
        if (checkUsername) {
          return {
            success: false,
            error: UNIQUE_CONSTRAINT_MESSAGE,
            code: "BAD_REQUEST",
          };
        }
      }

      if (body.email && body.email !== existingInvestor.email) {
        const checkEmail = await this.repository.findByEmail(body.email);
        if (checkEmail) {
          return {
            success: false,
            error: EMAIL_CONSTRAINT_MESSAGE,
            code: "BAD_REQUEST",
          };
        }
      }

      const updateData: {
        username: string;
        namaLengkap: string;
        perusahaan: string | null;
        email: string;
        noTelp: string | null;
        passwordHash?: string;
      } = {
        username: body.username || existingInvestor.username,
        namaLengkap: body.namaLengkap || existingInvestor.namaLengkap,
        perusahaan: body.perusahaan ?? existingInvestor.perusahaan,
        email: body.email || existingInvestor.email,
        noTelp: body.noTelp ?? existingInvestor.noTelp,
      };

      if (body.password && body.password.trim() !== "") {
        updateData.passwordHash = await hash(body.password, 12);
      }

      const updatedInvestor = await this.repository.update(id, updateData);
      return { success: true, data: toSafeInvestor(updatedInvestor) };
    } catch {
      return {
        success: false,
        error: UPDATE_ERROR_MESSAGE,
        code: "UPDATE_ERROR",
      };
    }
  }

  async toggleInvestorActive(
    id: string,
    isActive: boolean,
  ): Promise<ServiceResult<SafeInvestor>> {
    try {
      const existingInvestor = await this.repository.findById(id);
      if (!existingInvestor) {
        return { success: false, error: NOT_FOUND_MESSAGE, code: "NOT_FOUND" };
      }

      const updatedInvestor = await this.repository.update(id, { isActive });
      return { success: true, data: toSafeInvestor(updatedInvestor) };
    } catch {
      return {
        success: false,
        error: TOGGLE_ERROR_MESSAGE,
        code: "UPDATE_ERROR",
      };
    }
  }

  async deleteInvestorById(
    id: string,
  ): Promise<ServiceResult<{ username: string }>> {
    try {
      const investor = await this.repository.findByIdWithCounts(id);
      if (!investor) {
        return { success: false, error: NOT_FOUND_MESSAGE, code: "NOT_FOUND" };
      }

      if (investor._count.rabProjects > 0 || investor._count.payouts > 0) {
        return {
          success: false,
          error: RELATION_CONSTRAINT_MESSAGE,
          code: "BAD_REQUEST",
        };
      }

      await this.repository.delete(id);
      return { success: true, data: { username: investor.username } };
    } catch {
      return {
        success: false,
        error: DELETE_ERROR_MESSAGE,
        code: "DELETE_ERROR",
      };
    }
  }
}

let investorAdminService: InvestorAdminService | null = null;

export function getInvestorAdminService(): InvestorAdminService {
  if (!investorAdminService) {
    investorAdminService = new InvestorAdminService();
  }

  return investorAdminService;
}

export async function getInvestors() {
  return getInvestorAdminService().getInvestors();
}

export async function createInvestor(body: InvestorCreateInput) {
  return getInvestorAdminService().createInvestor(body);
}

export async function getInvestorById(id: string) {
  return getInvestorAdminService().getInvestorById(id);
}

export async function updateInvestorById(
  id: string,
  body: InvestorUpdateInput,
) {
  return getInvestorAdminService().updateInvestorById(id, body);
}

export async function toggleInvestorActive(id: string, isActive: boolean) {
  return getInvestorAdminService().toggleInvestorActive(id, isActive);
}

export async function deleteInvestorById(id: string) {
  return getInvestorAdminService().deleteInvestorById(id);
}

export const investorAdminErrorMessages = {
  unique: UNIQUE_CONSTRAINT_MESSAGE,
  email: EMAIL_CONSTRAINT_MESSAGE,
  relation: RELATION_CONSTRAINT_MESSAGE,
};
