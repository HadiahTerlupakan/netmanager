import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../domain/entities/SalaryEntity";
import type { ISalaryComponentRepository } from "../domain/ports/ISalaryComponentRepository";
import type {
  ISalaryUserRepository,
  UpdateSalaryUserConfigInput,
} from "../domain/ports/ISalaryUserRepository";
import { SalaryComponentRepository } from "../repositories/SalaryComponentRepository";
import { SalaryUserRepository } from "../repositories/SalaryDataRepository";

interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface SalaryUserConfigInput {
  basicSalary?: number | string | null;
  employeeType?: EmployeeType;
  overtimeRateNormal?: number | string | null;
  overtimeCalcTypeNormal?: RateType;
  overtimeRateHoliday?: number | string | null;
  overtimeCalcTypeHoliday?: RateType;
  overtimeRateNational?: number | string | null;
  overtimeCalcTypeNational?: RateType;
  woIncentiveRate?: number | string | null;
  lateDeductionRate?: number | string | null;
  absentDeductionRate?: number | string | null;
  joinDate?: string | null;
  ptkpStatus?: PtkpStatus | null;
  bpjsKesehatan?: boolean;
  bpjsKetenagakerjaan?: boolean;
}

interface AssignSalaryComponentInput {
  componentId: string;
  amount: number;
  notes?: string;
}

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
        this.buildCreateUserConfig(input),
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
        this.buildUpdateUserConfig(input),
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
      const sortedComponents = components.sort(
        (left, right) => left.component.sortOrder - right.component.sortOrder,
      );

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

  /** Build payload for creating salary user config. */
  private buildCreateUserConfig(input: {
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
  }): UpdateSalaryUserConfigInput {
    return {
      basicSalary: input.basicSalary,
      employeeType: input.employeeType,
      overtimeCalcTypeNormal: input.overtimeCalcTypeNormal,
      overtimeCalcTypeHoliday: input.overtimeCalcTypeHoliday,
      overtimeCalcTypeNational: input.overtimeCalcTypeNational,
      ...(input.overtimeRateNormal !== undefined
        ? { overtimeRateNormal: input.overtimeRateNormal }
        : {}),
      ...(input.overtimeRateHoliday !== undefined
        ? { overtimeRateHoliday: input.overtimeRateHoliday }
        : {}),
      ...(input.overtimeRateNational !== undefined
        ? { overtimeRateNational: input.overtimeRateNational }
        : {}),
      ...(input.woIncentiveRate !== undefined
        ? { woIncentiveRate: input.woIncentiveRate }
        : {}),
      ...(input.lateDeductionRate !== undefined
        ? { lateDeductionRate: input.lateDeductionRate }
        : {}),
      ...(input.absentDeductionRate !== undefined
        ? { absentDeductionRate: input.absentDeductionRate }
        : {}),
      ...(input.joinDate !== undefined
        ? { joinDate: input.joinDate ? new Date(input.joinDate) : null }
        : {}),
      ...(input.ptkpStatus !== undefined
        ? { ptkpStatus: input.ptkpStatus }
        : {}),
      ...(input.bpjsKesehatan !== undefined
        ? { bpjsKesehatan: input.bpjsKesehatan }
        : {}),
      ...(input.bpjsKetenagakerjaan !== undefined
        ? { bpjsKetenagakerjaan: input.bpjsKetenagakerjaan }
        : {}),
    };
  }

  /** Build payload for updating salary user config. */
  private buildUpdateUserConfig(
    input: SalaryUserConfigInput,
  ): UpdateSalaryUserConfigInput {
    return {
      ...(input.employeeType !== undefined
        ? { employeeType: input.employeeType }
        : {}),
      ...(input.basicSalary !== undefined
        ? { basicSalary: this.parseNullableNumber(input.basicSalary) }
        : {}),
      ...(input.overtimeRateNormal !== undefined
        ? {
            overtimeRateNormal: this.parseNullableNumber(
              input.overtimeRateNormal,
            ),
          }
        : {}),
      ...(input.overtimeCalcTypeNormal !== undefined
        ? { overtimeCalcTypeNormal: input.overtimeCalcTypeNormal }
        : {}),
      ...(input.overtimeRateHoliday !== undefined
        ? {
            overtimeRateHoliday: this.parseNullableNumber(
              input.overtimeRateHoliday,
            ),
          }
        : {}),
      ...(input.overtimeCalcTypeHoliday !== undefined
        ? { overtimeCalcTypeHoliday: input.overtimeCalcTypeHoliday }
        : {}),
      ...(input.overtimeRateNational !== undefined
        ? {
            overtimeRateNational: this.parseNullableNumber(
              input.overtimeRateNational,
            ),
          }
        : {}),
      ...(input.overtimeCalcTypeNational !== undefined
        ? { overtimeCalcTypeNational: input.overtimeCalcTypeNational }
        : {}),
      ...(input.woIncentiveRate !== undefined
        ? { woIncentiveRate: this.parseNullableNumber(input.woIncentiveRate) }
        : {}),
      ...(input.lateDeductionRate !== undefined
        ? {
            lateDeductionRate: this.parseNullableNumber(
              input.lateDeductionRate,
            ),
          }
        : {}),
      ...(input.absentDeductionRate !== undefined
        ? {
            absentDeductionRate: this.parseNullableNumber(
              input.absentDeductionRate,
            ),
          }
        : {}),
      ...(input.joinDate !== undefined
        ? { joinDate: input.joinDate ? new Date(input.joinDate) : null }
        : {}),
      ...(input.ptkpStatus !== undefined
        ? { ptkpStatus: input.ptkpStatus }
        : {}),
      ...(input.bpjsKesehatan !== undefined
        ? { bpjsKesehatan: input.bpjsKesehatan }
        : {}),
      ...(input.bpjsKetenagakerjaan !== undefined
        ? { bpjsKetenagakerjaan: input.bpjsKetenagakerjaan }
        : {}),
    };
  }

  /** Parse nullable numeric input. */
  private parseNullableNumber(value: number | string | null): number | null {
    if (value === null || value === "") {
      return null;
    }

    return Number.parseFloat(String(value));
  }
}

let salaryUserServiceInstance: SalaryUserService | null = null;

export function getSalaryUserService(): SalaryUserService {
  if (!salaryUserServiceInstance) {
    salaryUserServiceInstance = new SalaryUserService();
  }

  return salaryUserServiceInstance;
}
