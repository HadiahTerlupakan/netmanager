import type { MixRadiusCustomerDetail, MixRadiusIncomePeriodRecord } from "./MixRadiusService"
import { getMixRadiusService } from "./MixRadiusService"
import { MixRadiusRepository } from "../repositories/MixRadiusRepository"

export class MixRadiusSyncService {
  private repo: MixRadiusRepository

  constructor() {
    this.repo = new MixRadiusRepository()
  }

  async syncCustomer(data: MixRadiusCustomerDetail, tenantId?: string) {
    if (!data.username) {
      throw new Error("Username diperlukan untuk sinkronisasi")
    }

    const customerData = {
      mixRadiusId: data.id,
      username: data.username,
      fullName: data.fullname || data.username,
      address: data.address,
      phoneNumber: data.phonenumber,
      planName: data.plan_name,
      ownerName: data.owner_name,
      status: data.auth_status,
      expiredOn: this.parseDate(data.expired_on),
      lastSyncedAt: new Date(),
    }

    const finalTenantId = tenantId || "DEFAULT"
    const result = await this.repo.upsertMixRadiusCustomer({
      ...customerData,
      tenantId: finalTenantId
    })

    let linkedToPelanggan = false
    try {
      let pelanggan = await this.repo.findPelangganByMixRadiusId(data.id)

      if (!pelanggan) {
        pelanggan = await this.repo.findPelangganByUsername(data.username)
      }

      if (pelanggan && pelanggan.mixRadiusId !== data.id) {
        await this.repo.updatePelangganMixRadiusLink(pelanggan.id, data.id)
        linkedToPelanggan = true
      } else if (pelanggan) {
        await this.repo.updatePelangganSyncTimestamp(pelanggan.id)
        linkedToPelanggan = true
      }
    } catch (err) {
      console.warn(`[MixRadiusSync] Failed to link to Pelanggan table: ${err instanceof Error ? err.message : "Terjadi kesalahan"}`)
    }

    return { action: "synced", customer: result, linked: linkedToPelanggan }
  }

  async syncAllCustomers() {
    try {
      const service = getMixRadiusService()
      const response = await service.fetchCustomersPPP({ length: 10000 })

      if (!response.data || !Array.isArray(response.data)) {
        return { success: true, count: 0 }
      }

      let count = 0
      for (const customer of response.data) {
        const customerData = {
          mixRadiusId: customer.id,
          username: customer.username,
          fullName: customer.fullname,
          ownerName: customer.owner_name,
          status: customer.auth_status,
          expiredOn: this.parseDate(customer.expired_on),
          lastSyncedAt: new Date(),
        }

        await this.repo.upsertMixRadiusCustomer({
          ...customerData,
          tenantId: "DEFAULT"
        })
        count++
      }

      return { success: true, count }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'MixRadiusConfigError') {
        const msg = 'message' in error ? String(error.message) : 'Unknown error'
        console.warn(`[MixRadiusSync] Berhenti sinkronisasi pelanggan: ${msg}`)
        return { success: false, count: 0, reason: msg }
      }
      console.error("[MixRadiusSync] Full customer sync error:", error)
      throw error
    }
  }

  async syncYesterdaySettlement() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]

    console.log(`[MixRadiusSync] Running daily settlement sync for ${dateStr}`)
    return await this.syncInvoices(dateStr, dateStr)
  }

  async syncInvoices(startDate?: string, endDate?: string) {
    try {
      const service = getMixRadiusService()

      const now = new Date()
      const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const end = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`

      const response = await service.fetchIncomeByPeriod({
        startDate: start,
        endDate: end,
        length: 10000,
      })

      if (!response.data || !Array.isArray(response.data)) {
        return { success: true, count: 0 }
      }

      let syncCount = 0
      for (const record of response.data) {
        try {
          await this.upsertInvoice(record, undefined)
          syncCount++
        } catch (err) {
          console.error(`[MixRadiusSync] Failed to sync invoice ${record.invoice}:`, err)
        }
      }

      return { success: true, count: syncCount }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'MixRadiusConfigError') {
        const msg = 'message' in error ? String(error.message) : 'Unknown error'
        console.warn(`[MixRadiusSync] Berhenti sinkronisasi invoice: ${msg}`)
        return { success: false, count: 0, reason: msg }
      }
      console.error("[MixRadiusSync] Invoice sync error:", error)
      throw error
    }
  }

  private async upsertInvoice(record: MixRadiusIncomePeriodRecord, tenantId?: string) {
    const mixRadiusId = record.customer_id || record.username;
    const finalTenantId = tenantId || "DEFAULT"

    await this.repo.upsertMixRadiusCustomer({
      mixRadiusId,
      tenantId: finalTenantId,
      username: record.username,
      fullName: record.fullname,
      ownerName: record.owner_name,
      address: record.address,
      phoneNumber: record.phonenumber,
      planName: record.plan_name,
      lastSyncedAt: new Date(),
    })

    const amount = parseFloat(record.total.replace(/[^0-9.-]+/g, "")) || 0
    const issuedDate = this.parseDate(record.renewed_on) || new Date()
    const expiredOn = this.parseDate(record.expired_on)

    return await this.repo.upsertMixRadiusInvoice({
      mixRadiusId: record.id,
      tenantId: finalTenantId,
      invoiceNumber: record.invoice,
      username: record.username,
      fullName: record.fullname,
      ownerName: record.owner_name,
      planName: record.plan_name,
      amount,
      status: record.trx_status.toUpperCase() === "SUCCESS" ? "PAID" : record.trx_status.toUpperCase(),
      paymentMethod: record.payment_method,
      issuedDate,
      dueDate: expiredOn,
      expiredOn,
      syncedAt: new Date(),
    })
  }

  async getNPLStatistics(groupId?: string) {
    const now = new Date();
    const service = getMixRadiusService();

    let owners: string[] | null = null;
    if (groupId && groupId !== "all") {
      const group = await this.repo.findOwnerGroupById(groupId);
      if (group && group.owners && group.owners.length > 0) {
        owners = group.owners.map(o => o.split(/[—–-]/)[0].trim().toLowerCase());
      }
    }

    const response = await service.fetchCustomersPPP({ length: 10000 });
    const allCustomers = response.data || [];

    const stats = {
      under30: { count: 0, sum: 0 },
      between30And60: { count: 0, sum: 0 },
      between60And90: { count: 0, sum: 0 },
      over90: { count: 0, sum: 0 },
    };

    let totalCustomers = 0;

    const planAverages = await this.repo.getInvoicePlanAverages();

    const planPriceMap = new Map<string, number>();
    planAverages.forEach((pa) => {
      if (pa.planName && pa._avg.amount) {
        planPriceMap.set(pa.planName, Number(pa._avg.amount));
      }
    });

    const globalAverageResult = await this.repo.getInvoiceGlobalAverage();
    const globalAverage = Number(globalAverageResult._avg.amount) || 150000;

    for (const customer of allCustomers) {
      if (owners && (!customer.owner_name || !owners.includes(customer.owner_name.toLowerCase().trim()))) {
        continue;
      }

      totalCustomers++;

      const expiredDate = this.parseDate(customer.expired_on);
      const isExpired = expiredDate && expiredDate < now;
      const isNPL =
        customer.auth_status === "Disabled-Users" ||
        customer.auth_status === "Isolir" ||
        (customer.auth_status === "Enabled-Users" && isExpired);

      if (isNPL && expiredDate) {
        const diffTime = now.getTime() - expiredDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        let amount = 0;
        if (customer.total) {
          amount = typeof customer.total === "string"
            ? parseFloat(customer.total.replace(/[^0-9.-]+/g, ""))
            : Number(customer.total);
        }

        if (amount === 0) {
          const planAvg = customer.plan_name ? planPriceMap.get(customer.plan_name) : undefined;
          if (planAvg !== undefined) {
            amount = planAvg;
          } else {
            const priceMatch = customer.plan_name?.match(/(\d+)[kK]/);
            if (priceMatch) {
              amount = parseInt(priceMatch[1]) * 1000;
            } else {
              amount = globalAverage;
            }
          }
        }

        if (diffDays < 30) {
          stats.under30.count++;
          stats.under30.sum += amount;
        } else if (diffDays >= 30 && diffDays < 60) {
          stats.between30And60.count++;
          stats.between30And60.sum += amount;
        } else if (diffDays >= 60 && diffDays < 90) {
          stats.between60And90.count++;
          stats.between60And90.sum += amount;
        } else {
          stats.over90.count++;
          stats.over90.sum += amount;
        }
      }
    }

    return { ...stats, totalCustomers };
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || dateStr === "0000-00-00 00:00:00") return null
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }
}

export const syncService = new MixRadiusSyncService()
