import { prisma, prismaBilling } from "@/modules/database";

import {
  countCalendarDays,
  countWorkingDays,
  toWibDateKey,
} from "../domain/wib-calendar";
import type {
  BillingVolumeSource,
  TicketCounts,
  TicketSource,
} from "../domain/ports/self-assessment-sources";

/**
 * Cacah keluhan pelanggan untuk parameter non-jaringan ISP.
 *
 * Tiket dibaca lewat `prisma` biasa sehingga ekstensi isolasi tenant tetap
 * berlaku; `tenantId` pada query adalah penegasan, bukan satu-satunya penjaga.
 */
export class SupportTicketCounts implements TicketSource {
  async countTickets(
    query: Parameters<TicketSource["countTickets"]>[0],
  ): Promise<TicketCounts> {
    const diterima = await prisma.supportTickets.findMany({
      where: {
        tenantId: query.tenantId,
        category: { in: query.categories },
        createdAt: { gte: query.from, lte: query.to },
        // Tiket tidak menyimpan site sendiri; sitenya mengikuti pelanggan.
        ...(query.siteIds
          ? { pelanggan: { siteId: { in: query.siteIds } } }
          : {}),
      },
      select: { createdAt: true, resolvedAt: true, closedAt: true },
    });

    // Komdigi menghitung "diselesaikan", bukan "ditutup secara administratif".
    // `closedAt` dipakai hanya bila `resolvedAt` kosong, supaya tiket yang
    // langsung ditutup tidak hilang dari pembilang.
    const selesai = diterima
      .map((tiket) => ({
        mulai: tiket.createdAt,
        selesai: tiket.resolvedAt ?? tiket.closedAt,
      }))
      .filter(
        (tiket): tiket is { mulai: Date; selesai: Date } =>
          tiket.selesai !== null,
      );

    if (!query.limit) {
      return {
        received: diterima.length,
        resolved: selesai.length,
        resolvedWithinLimit: selesai.length,
      };
    }

    const { maxDays, dayUnit, holidays } = query.limit;
    const kunciLibur = new Set(holidays.map(toWibDateKey));
    const dalamBatas = selesai.filter((tiket) => {
      const durasi =
        dayUnit === "WORKING"
          ? countWorkingDays(tiket.mulai, tiket.selesai, kunciLibur)
          : countCalendarDays(tiket.mulai, tiket.selesai);
      return durasi <= maxDays;
    });

    return {
      received: diterima.length,
      resolved: selesai.length,
      resolvedWithinLimit: dalamBatas.length,
    };
  }
}

/**
 * Penyebut parameter keluhan.
 *
 * Tagihan ada di database billing yang terpisah dari database utama, jadi
 * cacahnya diambil lewat klien tersendiri.
 */
export class BillingVolume implements BillingVolumeSource {
  async countInvoices(
    query: Parameters<BillingVolumeSource["countInvoices"]>[0],
  ): Promise<number> {
    return prismaBilling.invoice.count({
      where: {
        tenantId: query.tenantId,
        createdAt: { gte: query.from, lte: query.to },
        ...(query.siteIds ? { siteId: { in: query.siteIds } } : {}),
      },
    });
  }

  async countCustomers(
    query: Parameters<BillingVolumeSource["countCustomers"]>[0],
  ): Promise<number> {
    return prisma.pelanggan.count({
      where: {
        tenantId: query.tenantId,
        createdAt: { lte: query.asOf },
        ...(query.siteIds ? { siteId: { in: query.siteIds } } : {}),
      },
    });
  }
}
