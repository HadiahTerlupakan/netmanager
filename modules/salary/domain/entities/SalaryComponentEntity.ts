import type { RateType, SalaryComponentType } from "./SalaryEntity";

export interface SalaryComponentEntity {
  id: string;
  name: string;
  type: SalaryComponentType;
  rateType: RateType;
  defaultAmount: number | null;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSalaryComponentEntity {
  id: string;
  userId: string;
  componentId: string;
  amount: number;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSalaryComponentWithComponentEntity extends UserSalaryComponentEntity {
  component: SalaryComponentEntity;
}

export interface UserBasicSalaryEntity {
  id: string;
  basicSalaryAmount: number;
}
