import { prismaAuth } from "@/lib/prisma";
import { prismaMitraAuth } from "@/lib/prisma-mitra";

export type RoleToExclude = "EMPLOYEE" | "CUSTOMER" | "MITRA";
export type GlobalIdentifierResult =
  | { exists: true; role: string; field: string }
  | { exists: false };

interface GlobalIdentifierLookupInput {
  identifier: string;
  excludeId?: string;
}

interface GlobalIdentifierRepository {
  findPelangganIdentifier(input: GlobalIdentifierLookupInput): Promise<{
    username: string | null;
    idPelanggan: string | null;
    email: string | null;
  } | null>;
  findEmployeeIdentifier(
    input: GlobalIdentifierLookupInput,
  ): Promise<{ id: string } | null>;
  findMitraIdentifier(
    input: GlobalIdentifierLookupInput,
  ): Promise<{ id: string } | null>;
}

class PrismaGlobalIdentifierRepository implements GlobalIdentifierRepository {
  async findPelangganIdentifier(input: GlobalIdentifierLookupInput) {
    return prismaAuth.pelanggan.findFirst({
      where: {
        OR: [
          { username: { equals: input.identifier, mode: "insensitive" } },
          { idPelanggan: { equals: input.identifier, mode: "insensitive" } },
          { email: { equals: input.identifier, mode: "insensitive" } },
        ],
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: { id: true, username: true, idPelanggan: true, email: true },
    });
  }

  async findEmployeeIdentifier(input: GlobalIdentifierLookupInput) {
    return prismaAuth.user.findFirst({
      where: {
        email: { equals: input.identifier, mode: "insensitive" },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: { id: true },
    });
  }

  async findMitraIdentifier(input: GlobalIdentifierLookupInput) {
    return prismaMitraAuth.mitra.findFirst({
      where: {
        email: { equals: input.identifier, mode: "insensitive" },
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      select: { id: true },
    });
  }
}

export class GlobalIdentifierService {
  constructor(
    private readonly repository: GlobalIdentifierRepository = new PrismaGlobalIdentifierRepository(),
  ) {}

  /** Checks whether an identifier exists across customer, employee, and mitra accounts. */
  async check(
    identifier: string,
    excludeRole?: RoleToExclude,
    excludeId?: string,
  ): Promise<GlobalIdentifierResult> {
    if (!identifier) return { exists: false };

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const lookup = { identifier: normalizedIdentifier, excludeId };

    if (excludeRole !== "CUSTOMER") {
      const pelanggan = await this.repository.findPelangganIdentifier(lookup);
      if (pelanggan)
        return this.mapPelangganResult(pelanggan, normalizedIdentifier);
    }

    if (excludeRole !== "EMPLOYEE") {
      const user = await this.repository.findEmployeeIdentifier(lookup);
      if (user) return { exists: true, role: "Karyawan", field: "email" };
    }

    if (excludeRole !== "MITRA") {
      const mitra = await this.repository.findMitraIdentifier(lookup);
      if (mitra) return { exists: true, role: "Mitra", field: "email" };
    }

    return { exists: false };
  }

  private mapPelangganResult(
    pelanggan: {
      username: string | null;
      idPelanggan: string | null;
      email: string | null;
    },
    identifier: string,
  ): GlobalIdentifierResult {
    if (pelanggan.username?.toLowerCase() === identifier) {
      return { exists: true, role: "Pelanggan", field: "username" };
    }

    if (pelanggan.idPelanggan?.toLowerCase() === identifier) {
      return { exists: true, role: "Pelanggan", field: "ID Pelanggan" };
    }

    if (pelanggan.email?.toLowerCase() === identifier) {
      return { exists: true, role: "Pelanggan", field: "email" };
    }

    return { exists: true, role: "Pelanggan", field: "identifier" };
  }
}

const globalIdentifierService = new GlobalIdentifierService();

/** Checks if an identifier exists across all user types. */
export async function checkGlobalIdentifier(
  identifier: string,
  excludeRole?: RoleToExclude,
  excludeId?: string,
): Promise<GlobalIdentifierResult> {
  return globalIdentifierService.check(identifier, excludeRole, excludeId);
}
