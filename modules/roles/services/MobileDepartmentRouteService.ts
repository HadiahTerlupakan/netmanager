import { createDepartmentRepository } from "../factories/RepositoryFactory";

export interface MobileDepartmentOption {
  id: string;
  name: string;
}

/** Mengambil daftar departemen untuk picker mobile work order. */
export async function getMobileDepartments(): Promise<
  MobileDepartmentOption[]
> {
  const repository = createDepartmentRepository();
  const departments = await repository.findAll({ showInMobileWO: true });
  return departments.map(({ id, name }) => ({ id, name }));
}
