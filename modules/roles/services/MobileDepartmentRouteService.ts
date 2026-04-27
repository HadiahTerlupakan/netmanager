import { DepartmentRepository } from "../repositories/DepartmentRepository";

export interface MobileDepartmentOption {
  id: string;
  name: string;
}

/** Mengambil daftar departemen untuk picker mobile work order. */
export async function getMobileDepartments(): Promise<
  MobileDepartmentOption[]
> {
  const repository = new DepartmentRepository();
  const departments = await repository.findAll();
  return departments
    .filter((department) => department.showInMobileWO)
    .map(({ id, name }) => ({ id, name }));
}
