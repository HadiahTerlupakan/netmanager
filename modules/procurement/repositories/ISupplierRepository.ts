import { type Supplier, type Prisma } from "@prisma/client";

export interface ISupplierRepository {
    findAll(params?: { search?: string, skip?: number, take?: number }): Promise<{ data: Supplier[], total: number }>;
    findById(id: string): Promise<Supplier | null>;
    findByCode(code: string): Promise<Supplier | null>;
    create(data: Prisma.SupplierCreateInput): Promise<Supplier>;
    update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier>;
    delete(id: string): Promise<Supplier>;
}
