import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import type { DepartmentEntity } from "../domain/entities/DepartmentEntity";
import type {
  DepartmentCreateData,
  DepartmentUpdateData,
  IDepartmentRepository,
} from "../domain/ports/IDepartmentRepository";

export class DepartmentRepository implements IDepartmentRepository {
  /** Get all departments with user counts. */
  async findAll(): Promise<DepartmentEntity[]> {
    const departments = await prisma.departments.findMany({
      include: { _count: { select: { user: true } } },
      orderBy: { name: "asc" },
    });
    return departments.map((department) => this.toDomain(department));
  }

  /** Get department by ID. */
  async findById(id: string): Promise<DepartmentEntity | null> {
    const department = await prisma.departments.findUnique({
      where: { id },
      include: { _count: { select: { user: true } } },
    });
    return department ? this.toDomain(department) : null;
  }

  /** Get department by name. */
  async findByName(name: string): Promise<DepartmentEntity | null> {
    const department = await prisma.departments.findFirst({
      where: { name },
      include: { _count: { select: { user: true } } },
    });
    return department ? this.toDomain(department) : null;
  }

  /** Create a department entity. */
  async create(data: DepartmentCreateData): Promise<{ id: string }> {
    return prisma.departments.create({
      data: { id: randomUUID(), ...data, updatedAt: new Date() },
      select: { id: true },
    });
  }

  /** Update a department entity. */
  async update(id: string, data: DepartmentUpdateData): Promise<void> {
    await prisma.departments.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  /** Delete a department entity. */
  async delete(id: string): Promise<void> {
    await prisma.departments.delete({ where: { id } });
  }

  /** Count total departments. */
  async count(): Promise<number> {
    return prisma.departments.count();
  }

  private toDomain(department: {
    id: string;
    name: string;
    description: string | null;
    jobDescription: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { user: number };
  }): DepartmentEntity {
    return {
      id: department.id,
      name: department.name,
      description: department.description,
      jobDescription: department.jobDescription,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
      counts: { users: department._count?.user ?? 0 },
    };
  }
}
