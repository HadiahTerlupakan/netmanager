import { hash } from "bcryptjs";

import { logActivitySafe } from "@/lib/logger";
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
    actorId?: string,
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

      if (body.email) {
        const existingEmail = await this.repository.findByEmail(body.email);
        if (existingEmail) {
          return {
            success: false,
            error: EMAIL_CONSTRAINT_MESSAGE,
            code: "BAD_REQUEST",
          };
        }
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

      if (actorId) {
        logActivitySafe({
          action: "CREATE",
          subject: "Investor",
          userId: actorId,
          details: {
            investorId: investor.id,
            username: investor.username,
            namaLengkap: investor.namaLengkap,
            tenantId: body.tenantId,
          },
        });
      }

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
    actorId?: string,
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

      if (actorId) {
        logActivitySafe({
          action: "UPDATE",
          subject: "Investor",
          userId: actorId,
          details: {
            investorId: id,
            changes: {
              username: body.username,
              namaLengkap: body.namaLengkap,
              perusahaan: body.perusahaan,
              email: body.email,
              noTelp: body.noTelp,
              passwordChanged: Boolean(body.password && body.password.trim()),
            },
          },
        });
      }

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
    actorId?: string,
  ): Promise<ServiceResult<SafeInvestor>> {
    try {
      const existingInvestor = await this.repository.findById(id);
      if (!existingInvestor) {
        return { success: false, error: NOT_FOUND_MESSAGE, code: "NOT_FOUND" };
      }

      const updatedInvestor = await this.repository.update(id, { isActive });

      if (actorId) {
        logActivitySafe({
          action: isActive ? "ACTIVATE" : "DEACTIVATE",
          subject: "Investor",
          userId: actorId,
          details: { investorId: id, isActive },
        });
      }

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
    actorId?: string,
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

      if (actorId) {
        logActivitySafe({
          action: "DELETE",
          subject: "Investor",
          userId: actorId,
          details: { investorId: id, username: investor.username },
        });
      }

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

export async function createInvestor(
  body: InvestorCreateInput,
  actorId?: string,
) {
  return getInvestorAdminService().createInvestor(body, actorId);
}

export async function getInvestorById(id: string) {
  return getInvestorAdminService().getInvestorById(id);
}

export async function updateInvestorById(
  id: string,
  body: InvestorUpdateInput,
  actorId?: string,
) {
  return getInvestorAdminService().updateInvestorById(id, body, actorId);
}

export async function toggleInvestorActive(
  id: string,
  isActive: boolean,
  actorId?: string,
) {
  return getInvestorAdminService().toggleInvestorActive(id, isActive, actorId);
}

export async function deleteInvestorById(id: string, actorId?: string) {
  return getInvestorAdminService().deleteInvestorById(id, actorId);
}

export const investorAdminErrorMessages = {
  unique: UNIQUE_CONSTRAINT_MESSAGE,
  email: EMAIL_CONSTRAINT_MESSAGE,
  relation: RELATION_CONSTRAINT_MESSAGE,
};
