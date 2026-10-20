import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { IVpnCoreRouterTombstoneRepository } from "../domain/ports/IVpnCoreRouterTombstoneRepository";

/** Akses database untuk antrean penghapusan router core. */
export class VpnCoreRouterTombstoneRepository implements IVpnCoreRouterTombstoneRepository {
  constructor(private client: PrismaClient = prisma) {}

  /** Mencatat id router core; mencatat id yang sama dua kali tidak berefek. */
  async add(coreRouterId: string): Promise<void> {
    await this.client.vpnCoreRouterTombstone.upsert({
      where: { coreRouterId },
      create: { coreRouterId },
      update: {},
    });
  }

  /** Id router core yang paling lama menunggu, paling lama lebih dulu. */
  async listOldest(limit: number): Promise<string[]> {
    const rows = await this.client.vpnCoreRouterTombstone.findMany({
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((row) => row.coreRouterId);
  }

  /** Menghapus catatan; tidak gagal bila catatan sudah tidak ada. */
  async remove(coreRouterId: string): Promise<void> {
    await this.client.vpnCoreRouterTombstone.deleteMany({
      where: { coreRouterId },
    });
  }

  /** True bila id router core sedang menunggu dihapus (draft tidak boleh dipakai lagi). */
  async has(coreRouterId: string): Promise<boolean> {
    const row = await this.client.vpnCoreRouterTombstone.findUnique({
      where: { coreRouterId },
      select: { coreRouterId: true },
    });
    return Boolean(row);
  }

  /**
   * True bila router netmanager mana pun memakai id router core ini. Pemanggil
   * harus berada di konteks sistem karena MikroTikRouter disaring per tenant.
   */
  async isUsedByRouter(coreRouterId: string): Promise<boolean> {
    const row = await this.client.mikroTikRouter.findFirst({
      where: { vpnCoreRouterId: coreRouterId },
      select: { id: true },
    });
    return Boolean(row);
  }
}
