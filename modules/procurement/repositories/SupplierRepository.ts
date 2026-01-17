import { prisma } from "@/lib/prisma";
import { type Supplier, type Prisma } from "@prisma/client";
import type { ISupplierRepository } from "./ISupplierRepository";

export class SupplierRepository implements ISupplierRepository {
    async findAll(params?: { search?: string; skip?: number; take?: number }): Promise<{ data: Supplier[]; total: number }> {
        const { search, skip, take } = params || {};
        
        const where: Prisma.SupplierWhereInput = search ? {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
            ]
        } : {};

        const [data, total] = await Promise.all([
            prisma.supplier.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.supplier.count({ where })
        ]);

        return { data, total };
    }

    async findById(id: string): Promise<Supplier | null> {
        return prisma.supplier.findUnique({ where: { id } });
    }

    async findByCode(code: string): Promise<Supplier | null> {
        return prisma.supplier.findUnique({ where: { code } });
    }

    async create(data: Prisma.SupplierCreateInput): Promise<Supplier> {
        return prisma.supplier.create({ data });
    }

    async update(id: string, data: Prisma.SupplierUpdateInput): Promise<Supplier> {
        return prisma.supplier.update({ where: { id }, data });
    }

    async delete(id: string): Promise<Supplier> {
        return prisma.supplier.delete({ where: { id } });
    }
}
