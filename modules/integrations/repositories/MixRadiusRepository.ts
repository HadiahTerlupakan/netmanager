import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { prismaBilling } from "@/lib/prisma-billing";

import { IntegrationMapper } from "../mappers/IntegrationMapper";
import type {
  IMixRadiusDataRepository,
  UpsertMixRadiusCustomerInput,
  UpsertMixRadiusInvoiceInput,
} from "../domain/ports/IMixRadiusDataRepository";

export class MixRadiusRepository implements IMixRadiusDataRepository {
  /** Upsert a synced MixRadius customer. */
  async upsertMixRadiusCustomer(data: UpsertMixRadiusCustomerInput) {
    const model = await prismaBilling.mixRadiusCustomer.upsert({
      where: {
        tenantId_mixRadiusId: {
          tenantId: data.tenantId,
          mixRadiusId: data.mixRadiusId,
        },
      },
      update: {
        username: data.username,
        fullName: data.fullName,
        address: data.address,
        phoneNumber: data.phoneNumber,
        planName: data.planName,
        ownerName: data.ownerName,
        status: data.status,
        expiredOn: data.expiredOn,
        lastSyncedAt: data.lastSyncedAt,
      },
      create: {
        id: randomUUID(),
        mixRadiusId: data.mixRadiusId,
        tenantId: data.tenantId,
        username: data.username,
        fullName: data.fullName,
        address: data.address,
        phoneNumber: data.phoneNumber,
        planName: data.planName,
        ownerName: data.ownerName,
        status: data.status,
        expiredOn: data.expiredOn,
        lastSyncedAt: data.lastSyncedAt,
      },
    });

    return IntegrationMapper.toSyncedCustomerDomain(model);
  }

  /** Find pelanggan by MixRadius id. */
  async findPelangganByMixRadiusId(mixRadiusId: string) {
    return prisma.pelanggan.findUnique({
      where: { mixRadiusId },
      select: {
        id: true,
        idPelanggan: true,
        mixRadiusId: true,
        lastSyncedAt: true,
      },
    });
  }

  /** Find pelanggan by username. */
  async findPelangganByUsername(username: string) {
    return prisma.pelanggan.findFirst({
      where: { idPelanggan: username },
      select: {
        id: true,
        idPelanggan: true,
        mixRadiusId: true,
        lastSyncedAt: true,
      },
    });
  }

  /** Update pelanggan MixRadius link. */
  async updatePelangganMixRadiusLink(pelangganId: string, mixRadiusId: string) {
    return prisma.pelanggan.update({
      where: { id: pelangganId },
      data: { mixRadiusId, lastSyncedAt: new Date() },
      select: {
        id: true,
        idPelanggan: true,
        mixRadiusId: true,
        lastSyncedAt: true,
      },
    });
  }

  /** Update pelanggan sync timestamp. */
  async updatePelangganSyncTimestamp(pelangganId: string) {
    return prisma.pelanggan.update({
      where: { id: pelangganId },
      data: { lastSyncedAt: new Date() },
      select: {
        id: true,
        idPelanggan: true,
        mixRadiusId: true,
        lastSyncedAt: true,
      },
    });
  }

  /** Upsert a synced MixRadius invoice. */
  async upsertMixRadiusInvoice(data: UpsertMixRadiusInvoiceInput) {
    await prismaBilling.mixRadiusInvoice.upsert({
      where: {
        tenantId_invoiceNumber: {
          tenantId: data.tenantId,
          invoiceNumber: data.invoiceNumber,
        },
      },
      update: {
        username: data.username,
        fullName: data.fullName,
        ownerName: data.ownerName,
        planName: data.planName,
        amount: data.amount,
        status: data.status,
        paymentMethod: data.paymentMethod,
        issuedDate: data.issuedDate,
        dueDate: data.dueDate,
        expiredOn: data.expiredOn,
        syncedAt: data.syncedAt,
      },
      create: {
        id: randomUUID(),
        mixRadiusId: data.mixRadiusId,
        tenantId: data.tenantId,
        invoiceNumber: data.invoiceNumber,
        username: data.username,
        fullName: data.fullName,
        ownerName: data.ownerName,
        planName: data.planName,
        amount: data.amount,
        status: data.status,
        paymentMethod: data.paymentMethod,
        issuedDate: data.issuedDate,
        dueDate: data.dueDate,
        expiredOn: data.expiredOn,
        syncedAt: data.syncedAt,
      },
    });
  }

  /** Find owner group by id. */
  async findOwnerGroupById(groupId: string) {
    const model = await prismaBilling.mixRadiusOwnerGroup.findUnique({
      where: { id: groupId },
    });
    return model ? IntegrationMapper.toOwnerGroupDomain(model) : null;
  }

  /** Get invoice average per plan. */
  async getInvoicePlanAverages() {
    const result = await prismaBilling.mixRadiusInvoice.groupBy({
      by: ["planName"],
      _avg: { amount: true },
      where: { amount: { gt: 0 } },
    });

    return result.map((item) => ({
      planName: item.planName,
      averageAmount: Number(item._avg.amount ?? 0),
    }));
  }

  /** Get global invoice average. */
  async getInvoiceGlobalAverage() {
    const result = await prismaBilling.mixRadiusInvoice.aggregate({
      _avg: { amount: true },
      where: { amount: { gt: 0 } },
    });

    return { averageAmount: Number(result._avg.amount ?? 0) };
  }
}
