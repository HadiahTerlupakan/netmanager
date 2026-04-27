import type { SalaryComponent, UserSalaryComponent } from "@prisma/client";
import type {
  SalaryUserConfigEntity,
  SalaryUserDetailEntity,
  SalaryUserListEntity,
  SalaryUserWorkDaysEntity,
} from "../domain/entities/SalaryUserEntity";
import { SalaryMapper } from "./SalaryMapper";

type SalaryUserListRecord = {
  id: string;
  name: string | null;
  email: string;
  employeeType: string;
  basicSalary: number | null;
  overtimeRateNormal?: number | null;
  overtimeCalcTypeNormal?: string | null;
  overtimeRateHoliday?: number | null;
  overtimeCalcTypeHoliday?: string | null;
  overtimeRateNational?: number | null;
  overtimeCalcTypeNational?: string | null;
  woIncentiveRate?: number | null;
  lateDeductionRate?: number | null;
  absentDeductionRate?: number | null;
  joinDate?: Date | null;
  ptkpStatus?: string | null;
  bpjsKesehatan?: boolean;
  bpjsKetenagakerjaan?: boolean;
  departments?: { name: string } | null;
  role?: { name: string } | null;
};

type SalaryUserDetailRecord = SalaryUserListRecord & {
  image?: string | null;
  userSalaryComponents?: Array<
    UserSalaryComponent & { component: SalaryComponent }
  >;
};

export class SalaryUserMapper {
  /** Map salary user list record to domain entity. */
  static toListEntity(record: SalaryUserListRecord): SalaryUserListEntity {
    return {
      ...record,
      overtimeCalcTypeNormal: (record.overtimeCalcTypeNormal as never) ?? null,
      overtimeCalcTypeHoliday:
        (record.overtimeCalcTypeHoliday as never) ?? null,
      overtimeCalcTypeNational:
        (record.overtimeCalcTypeNational as never) ?? null,
      ptkpStatus: (record.ptkpStatus as never) ?? null,
    };
  }

  /** Map salary user detail record to domain entity. */
  static toDetailEntity(
    record: SalaryUserDetailRecord,
  ): SalaryUserDetailEntity {
    return {
      ...this.toListEntity(record),
      image: record.image ?? null,
      userSalaryComponents: record.userSalaryComponents?.map((component) =>
        SalaryMapper.toDomainUserComponentWithComponent(component),
      ),
    };
  }

  /** Map salary config record to domain entity. */
  static toConfigEntity(
    record: SalaryUserConfigEntity,
  ): SalaryUserConfigEntity {
    return {
      ...record,
      employeeType: record.employeeType,
      overtimeCalcTypeNormal: record.overtimeCalcTypeNormal,
      overtimeCalcTypeHoliday: record.overtimeCalcTypeHoliday,
      overtimeCalcTypeNational: record.overtimeCalcTypeNational,
      ptkpStatus: record.ptkpStatus,
    };
  }

  /** Map user work days record to domain entity. */
  static toWorkDaysEntity(record: {
    workDays: string | null;
  }): SalaryUserWorkDaysEntity {
    return { workDays: record.workDays };
  }
}
