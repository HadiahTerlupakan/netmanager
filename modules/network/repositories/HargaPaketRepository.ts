import { prisma } from "@/lib/prisma";
import { Prisma, Status, DurasiUnit } from "@prisma/client";
import {
  createProfilePpp,
  deleteProfilePpp,
  findProfilePppDetail,
  findProfilePppForDelete,
  findProfilePppForUpdate,
  findProfilePpps,
  findRoutersForProfileBroadcast,
  type ProfilePppDeleteRecord,
  type ProfilePppListInput,
  updateProfilePpp,
} from "./HargaPaketRepository.profile-ppp";

export interface HargaPaketCreateInput {
  name: string;
  harga: number;
  durasi: number;
  durasiUnit?: string;
  profilePPPId: string;
  siteId?: string;
  bandwidthId?: string;
  description?: string;
  featured?: boolean;
  status?: Status;
  tenantId?: string | null;
}

export interface HargaPaketUpdateInput {
  name?: string;
  harga?: number;
  durasi?: number;
  durasiUnit?: string;
  profilePPPId?: string;
  siteId?: string | null;
  bandwidthId?: string | null;
  description?: string;
  featured?: boolean;
  status?: Status;
  tenantId?: string | null;
}

export interface HargaPaketFilterOptions {
  status?: string;
  featured?: boolean;
  siteId?: string;
  tenantId?: string;
}

/**
 * Repository for HargaPaket (pricing package) operations
 */
export class HargaPaketRepository {
  /**
   * Get all harga pakets with filters
   */
  async findAll(options: HargaPaketFilterOptions = {}) {
    const where: Prisma.HargaPaketWhereInput = {};

    if (options.status) {
      where.status = options.status as Status;
    }
    if (options.featured !== undefined) {
      where.featured = options.featured;
    }
    if (options.siteId) {
      where.OR = [{ siteId: options.siteId }, { siteId: null }];
    }
    if (options.tenantId) {
      where.tenantId = options.tenantId;
    }

    return prisma.hargaPaket.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        bandwidth: true,
        profilePPP: true,
        site: true,
      },
    });
  }

  /**
   * Get harga paket by ID
   */
  async findById(id: string) {
    return prisma.hargaPaket.findUnique({
      where: { id },
      include: {
        bandwidth: true,
        site: true,
        profilePPP: {
          include: {
            mikroTikRouter: true,
          },
        },
      },
    });
  }

  /**
   * Create new harga paket
   */
  async create(data: HargaPaketCreateInput) {
    const createData: Prisma.HargaPaketUncheckedCreateInput = {
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      name: data.name,
      harga: data.harga,
      durasi: data.durasi,
      durasiUnit: (data.durasiUnit || "BULAN") as DurasiUnit,
      profilePPPId: data.profilePPPId,
      description: data.description,
      featured: data.featured ?? false,
      status: data.status || "AKTIF",
    };

    if (data.tenantId) {
      createData.tenantId = data.tenantId;
    }

    if (data.siteId && data.siteId.trim() !== "") {
      createData.siteId = data.siteId;
    }

    if (data.bandwidthId && data.bandwidthId.trim() !== "") {
      createData.bandwidthId = data.bandwidthId;
    }

    return prisma.hargaPaket.create({
      data: createData,
      include: {
        bandwidth: true,
        profilePPP: {
          include: {
            mikroTikRouter: true,
          },
        },
      },
    });
  }

  /**
   * Update harga paket
   */
  async update(id: string, data: HargaPaketUpdateInput) {
    const updateData: Prisma.HargaPaketUncheckedUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.harga !== undefined) updateData.harga = data.harga;
    if (data.durasi !== undefined) updateData.durasi = data.durasi;
    if (data.durasiUnit !== undefined)
      updateData.durasiUnit = data.durasiUnit as DurasiUnit;
    if (data.profilePPPId !== undefined)
      updateData.profilePPPId = data.profilePPPId;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.featured !== undefined) updateData.featured = data.featured;
    if (data.status !== undefined) updateData.status = data.status;

    if (data.tenantId !== undefined) updateData.tenantId = data.tenantId;

    // Handle optional site
    if (data.siteId === null) {
      updateData.siteId = null;
    } else if (data.siteId && data.siteId.trim() !== "") {
      updateData.siteId = data.siteId;
    }

    // Handle optional bandwidth
    if (data.bandwidthId === null) {
      updateData.bandwidthId = null;
    } else if (data.bandwidthId && data.bandwidthId.trim() !== "") {
      updateData.bandwidthId = data.bandwidthId;
    }

    return prisma.hargaPaket.update({
      where: { id },
      data: updateData,
      include: {
        bandwidth: true,
        profilePPP: {
          include: {
            mikroTikRouter: true,
          },
        },
      },
    });
  }

  /**
   * Delete harga paket
   */
  async delete(id: string) {
    return prisma.hargaPaket.delete({
      where: { id },
    });
  }

  /**
   * Check if name exists (for unique constraint)
   */
  async existsByName(name: string, excludeId?: string): Promise<boolean> {
    const existing = await prisma.hargaPaket.findFirst({
      where: {
        name,
        ...(excludeId && { id: { not: excludeId } }),
      },
    });
    return existing !== null;
  }

  /**
   * Count pelanggan using this harga paket
   */
  async countPelangganByHargaPaket(hargaPaketId: string): Promise<number> {
    return prisma.pelanggan.count({
      where: { hargaPaketId },
    });
  }

  /** Get profile PPP records for list flow. */
  async findProfilePpps(input: ProfilePppListInput) {
    return findProfilePpps(input);
  }

  /** Get profile PPP detail record. */
  async findProfilePppDetail(id: string) {
    return findProfilePppDetail(id);
  }

  /** Get profile PPP record for update flow. */
  async findProfilePppForUpdate(id: string) {
    return findProfilePppForUpdate(id);
  }

  /** Get profile PPP record for delete flow. */
  async findProfilePppForDelete(
    id: string,
  ): Promise<ProfilePppDeleteRecord | null> {
    return findProfilePppForDelete(id);
  }

  /** Create profile PPP and include router relation. */
  async createProfilePpp(data: Prisma.ProfilePPPUncheckedCreateInput) {
    return createProfilePpp(data);
  }

  /** Update profile PPP and include router relation. */
  async updateProfilePpp(
    id: string,
    data: Prisma.ProfilePPPUncheckedUpdateInput,
  ) {
    return updateProfilePpp(id, data);
  }

  /** Delete profile PPP by ID. */
  async deleteProfilePpp(id: string): Promise<void> {
    await deleteProfilePpp(id);
  }

  /** Get routers in scope for profile broadcast. */
  async findRoutersForProfileBroadcast(input: {
    tenantId?: string | null;
    siteId?: string | null;
  }) {
    return findRoutersForProfileBroadcast(input);
  }
}
