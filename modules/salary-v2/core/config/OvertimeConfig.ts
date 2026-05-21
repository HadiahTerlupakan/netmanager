import type { OvertimeDayType, OvertimeCapEnforcement } from "../domain/enums";

export interface OvertimeTier {
  dayType: OvertimeDayType;
  fromHour: number;
  toHour: number | null;
  multiplier: number;
}

export interface OvertimeConfig {
  maxHoursPerDay: number;
  maxHoursPerWeek: number;
  maxHoursPerMonth: number | null;
  rateBase: "1/173" | "custom";
  customRateBase: number | null;
  capEnforcement: OvertimeCapEnforcement;
  exceptionRoles: string[];
  tiers: OvertimeTier[];
}

export const DEFAULT_OVERTIME_CONFIG: OvertimeConfig = {
  maxHoursPerDay: 4,
  maxHoursPerWeek: 18,
  maxHoursPerMonth: null,
  rateBase: "1/173",
  customRateBase: null,
  capEnforcement: "SOFT_WARNING",
  exceptionRoles: [],
  tiers: [
    { dayType: "WORKDAY", fromHour: 0, toHour: 1, multiplier: 1.5 },
    { dayType: "WORKDAY", fromHour: 1, toHour: null, multiplier: 2 },
    { dayType: "HOLIDAY", fromHour: 0, toHour: 7, multiplier: 2 },
    { dayType: "HOLIDAY", fromHour: 7, toHour: 8, multiplier: 3 },
    { dayType: "HOLIDAY", fromHour: 8, toHour: null, multiplier: 4 },
    { dayType: "NATIONAL_HOLIDAY", fromHour: 0, toHour: 5, multiplier: 2 },
    { dayType: "NATIONAL_HOLIDAY", fromHour: 5, toHour: 6, multiplier: 3 },
    { dayType: "NATIONAL_HOLIDAY", fromHour: 6, toHour: null, multiplier: 4 },
  ],
};
