import type {
  EmployeeType,
  PtkpStatus,
  RateType,
} from "../domain/entities/SalaryEntity";
import type { UpdateSalaryUserConfigInput } from "../domain/ports/ISalaryUserRepository";

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface SalaryUserConfigInput {
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

export interface AssignSalaryComponentInput {
  componentId: string;
  amount: number;
  notes?: string;
}

/** Membuat payload update config gaji untuk user baru di payroll. */
export function buildCreateUserConfig(input: {
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
    ...buildOptionalNumberField("overtimeRateNormal", input.overtimeRateNormal),
    ...buildOptionalNumberField(
      "overtimeRateHoliday",
      input.overtimeRateHoliday,
    ),
    ...buildOptionalNumberField(
      "overtimeRateNational",
      input.overtimeRateNational,
    ),
    ...buildOptionalNumberField("woIncentiveRate", input.woIncentiveRate),
    ...buildOptionalNumberField("lateDeductionRate", input.lateDeductionRate),
    ...buildOptionalNumberField(
      "absentDeductionRate",
      input.absentDeductionRate,
    ),
    ...buildOptionalDateField(input.joinDate),
    ...buildOptionalPlainField("ptkpStatus", input.ptkpStatus),
    ...buildOptionalPlainField("bpjsKesehatan", input.bpjsKesehatan),
    ...buildOptionalPlainField(
      "bpjsKetenagakerjaan",
      input.bpjsKetenagakerjaan,
    ),
  };
}

/** Membuat payload update config gaji untuk user existing. */
export function buildUpdateUserConfig(
  input: SalaryUserConfigInput,
): UpdateSalaryUserConfigInput {
  return {
    ...buildOptionalPlainField("employeeType", input.employeeType),
    ...buildParsedNumberField("basicSalary", input.basicSalary),
    ...buildParsedNumberField("overtimeRateNormal", input.overtimeRateNormal),
    ...buildOptionalPlainField(
      "overtimeCalcTypeNormal",
      input.overtimeCalcTypeNormal,
    ),
    ...buildParsedNumberField("overtimeRateHoliday", input.overtimeRateHoliday),
    ...buildOptionalPlainField(
      "overtimeCalcTypeHoliday",
      input.overtimeCalcTypeHoliday,
    ),
    ...buildParsedNumberField(
      "overtimeRateNational",
      input.overtimeRateNational,
    ),
    ...buildOptionalPlainField(
      "overtimeCalcTypeNational",
      input.overtimeCalcTypeNational,
    ),
    ...buildParsedNumberField("woIncentiveRate", input.woIncentiveRate),
    ...buildParsedNumberField("lateDeductionRate", input.lateDeductionRate),
    ...buildParsedNumberField("absentDeductionRate", input.absentDeductionRate),
    ...buildOptionalDateField(input.joinDate),
    ...buildOptionalPlainField("ptkpStatus", input.ptkpStatus),
    ...buildOptionalPlainField("bpjsKesehatan", input.bpjsKesehatan),
    ...buildOptionalPlainField(
      "bpjsKetenagakerjaan",
      input.bpjsKetenagakerjaan,
    ),
  };
}

/** Mengurutkan assignment komponen berdasarkan sortOrder komponen. */
export function sortSalaryUserComponents<
  T extends { component: { sortOrder: number } },
>(components: T[]) {
  return components.sort(
    (left, right) => left.component.sortOrder - right.component.sortOrder,
  );
}

/** Mengubah input angka nullable menjadi number atau null. */
export function parseNullableNumber(value: number | string | null) {
  if (value === null || value === "") {
    return null;
  }

  return Number.parseFloat(String(value));
}

function buildOptionalNumberField(
  key: string,
  value: number | undefined,
): Record<string, number> | Record<string, never> {
  if (value === undefined) return {};
  return { [key]: value };
}

function buildParsedNumberField(
  key: string,
  value: number | string | null | undefined,
) {
  if (value === undefined) return {};
  return { [key]: parseNullableNumber(value) };
}

function buildOptionalDateField(value: string | null | undefined) {
  if (value === undefined) return {};
  return { joinDate: value ? new Date(value) : null };
}

function buildOptionalPlainField(key: string, value: unknown) {
  if (value === undefined) return {};
  return { [key]: value };
}
