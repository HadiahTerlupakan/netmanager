import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../domain/entities/SalaryEntity";
import type { ISalaryComponentRepository } from "../domain/ports/ISalaryComponentRepository";
import type { ISalaryUserRepository } from "../domain/ports/ISalaryUserRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryUserRepository } from "../repositories/SalaryDataRepository";
import {
  buildCreateUserConfig,
  buildUpdateUserConfig,
  sortSalaryUserComponents,
  type AssignSalaryComponentInput,
  type SalaryUserConfigInput,
  type ServiceResult,
} from "./SalaryUserService.helpers";

export class SalaryUserService {
  private readonly componentRepository: ISalaryComponentRepository;
  private readonly userRepository: ISalaryUserRepository;

  constructor(
    componentRepository: ISalaryComponentRepository = new SalaryComponentRepository(),
    userRepository: ISalaryUserRepository = new SalaryUserRepository(),
  ) {
    this.componentRepository = componentRepository;
    this.userRepository = userRepository;
  }

  /** Get salary users and all active users. */
  async listUsers(): Promise<
    ServiceResult<{ users: unknown[]; allUsers: unknown[] }>
  > {
    try {
      const [users, allUsers] = await Promise.all([
        this.userRepository.findSalaryUsers(),
        this.userRepository.findAllActiveUsersForSalaryList(),
      ]);

      return { success: true, data: { users, allUsers } };
    } catch {
      return {
        success: false,
        error: "Gagal mengambil data user gaji",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Add user into salary configuration list. */
  async addUser(input: {
    userId: string;
    basicSalary: number;
    employeeType: EmployeeType;
    overtimeRateNormal?: number;
    overtimeCalcTypeNormal: RateType;
    overtimeRateHoliday?: number;
    overtimeCalcTypeHoliday: RateType;
    overtimeRateNational?: number;
    overtimeCalcTypeNational: RateType;
    woIncentiveRate?: number;
    lateDeductionRate?: number;
    absentDeductionRate?: number;
    joinDate?: string | null;
    ptkpStatus?: PtkpStatus | null;
    bpjsKesehatan?: boolean;
    bpjsKetenagakerjaan?: boolean;
  }): Promise<ServiceResult<void>> {
    try {
      await this.userRepository.updateSalaryConfig(
        input.userId,
        buildCreateUserConfig(input),
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: "Gagal menambahkan user ke daftar gaji",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Get salary user detail by ID. */
  async getUser(userId: string): Promise<ServiceResult<{ user: unknown }>> {
    try {
      const user = await this.userRepository.findSalaryUserById(userId);

      if (!user) {
        return {
          success: false,
          error: "User tidak ditemukan",
          code: "NOT_FOUND",
        };
      }

      return { success: true, data: { user } };
    } catch {
      return {
        success: false,
        error: "Gagal mengambil detail user gaji",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Update salary configuration for one user. */
  async updateUser(
    userId: string,
    input: SalaryUserConfigInput,
  ): Promise<ServiceResult<void>> {
    try {
      await this.userRepository.updateSalaryConfig(
        userId,
        buildUpdateUserConfig(input),
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: "Gagal memperbarui konfigurasi gaji user",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Remove user from salary configuration list. */
  async removeUser(userId: string): Promise<ServiceResult<void>> {
    try {
      await this.userRepository.updateSalaryConfig(userId, {
        basicSalary: null,
      });
      return { success: true };
    } catch {
      return {
        success: false,
        error: "Gagal menghapus user dari daftar gaji",
        code: "DELETE_ERROR",
      };
    }
  }

  /** Get active salary components assigned to user. */
  async getUserComponents(
    userId: string,
  ): Promise<ServiceResult<{ components: unknown[] }>> {
    try {
      const components =
        await this.componentRepository.getUserComponents(userId);
      const sortedComponents = sortSalaryUserComponents(components);

      return { success: true, data: { components: sortedComponents } };
    } catch {
      return {
        success: false,
        error: "Gagal mengambil komponen gaji user",
        code: "FETCH_ERROR",
      };
    }
  }

  /** Assign salary component to user. */
  async assignComponent(
    userId: string,
    input: AssignSalaryComponentInput,
  ): Promise<ServiceResult<void>> {
    try {
      await this.componentRepository.assignToUser(
        userId,
        input.componentId,
        input.amount,
        input.notes,
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: "Gagal menambahkan komponen gaji",
        code: "UPDATE_ERROR",
      };
    }
  }

  /** Remove salary component assignment by assignment ID. */
  async removeComponent(assignmentId: string): Promise<ServiceResult<void>> {
    try {
      await this.componentRepository.deleteUserComponentAssignment(
        assignmentId,
      );
      return { success: true };
    } catch {
      return {
        success: false,
        error: "Gagal menghapus komponen gaji",
        code: "DELETE_ERROR",
      };
    }
  }
}

let salaryUserServiceInstance: SalaryUserService | null = null;

export function getSalaryUserService(): SalaryUserService {
  if (!salaryUserServiceInstance) {
    salaryUserServiceInstance = new SalaryUserService();
  }

  return salaryUserServiceInstance;
}
