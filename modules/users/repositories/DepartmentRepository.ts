import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";

import type {
  DepartmentCreateData,
  DepartmentPublic,
  DepartmentUpdateData,
  DepartmentWithUserCount,
  IDepartmentRepository,
} from "./IDepartmentRepository";

export class DepartmentRepository implements IDepartmentRepository {
  /** Ambil seluruh department beserta jumlah user. */
  async findAll(): Promise<DepartmentWithUserCount[]> {
    return await prisma.departments.findMany({
      include: {
        _count: {
          select: { user: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  /** Ambil department berdasarkan id. */
  async findById(id: string): Promise<DepartmentPublic | null> {
    return await prisma.departments.findUnique({
      where: { id },
    });
  }

  /** Ambil department berdasarkan nama. */
  async findByName(name: string): Promise<DepartmentPublic | null> {
    return await prisma.departments.findFirst({
      where: { name },
    });
  }

  /** Buat department baru. */
  async create(data: DepartmentCreateData): Promise<{ id: string }> {
    return await prisma.departments.create({
      data: {
        id: randomUUID(),
        ...data,
        updatedAt: new Date(),
      },
      select: { id: true },
    });
  }

  /** Ubah data department. */
  async update(id: string, data: DepartmentUpdateData): Promise<void> {
    await prisma.departments.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });
  }

  /** Hapus department berdasarkan id. */
  async delete(id: string): Promise<void> {
    await prisma.departments.delete({
      where: { id },
    });
  }

  /** Hitung total department. */
  async count(): Promise<number> {
    return await prisma.departments.count();
  }
}
