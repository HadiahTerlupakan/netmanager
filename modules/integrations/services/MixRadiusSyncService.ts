import { prisma } from "@/lib/prisma"
import { prismaBilling } from '@/lib/prisma-billing';
import type { MixRadiusCustomerDetail, MixRadiusIncomePeriodRecord } from "./MixRadiusService"
import { getMixRadiusService } from "./MixRadiusService"
import { randomUUID } from "crypto"

export class MixRadiusSyncService {
  /**
   * Sync customer data from MixRadius to Local Database.
   * 
   * Strategy:
   * 1. Check if customer already exists by mixRadiusId.
   * 2. If not, check by username (idPelanggan).
   * 3. Resolve HargaPaket (Plan):
   *    - Search for package with same name.
   *    - If not found, pick the first available active package as fallback.
   * 4. Upsert (Create or Update) the Pelanggan record.
   */
  async syncCustomer(data: MixRadiusCustomerDetail) {
    if (!data.username) {
      throw new Error("Username diperlukan untuk sinkronisasi")
    }

    // console.log(`[MixRadiusSync] Syncing customer: ${data.username} (${data.id})`)

    // Prepare Data
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

    // Upsert into MixRadiusCustomer using mixRadiusId as the unique key
    const result = await prismaBilling.mixRadiusCustomer.upsert({
      where: { mixRadiusId: data.id },
      update: customerData,
      create: {
        id: randomUUID(),
        ...customerData
      }
    })

    // Try to link to Pelanggan table
    let linkedToPelanggan = false
    try {
      // 1. Find by mixRadiusId
      let pelanggan = await prisma.pelanggan.findUnique({
        where: { mixRadiusId: data.id }
      })

      // 2. Fallback: Find by username (corresponding to idPelanggan)
      if (!pelanggan) {
        pelanggan = await prisma.pelanggan.findUnique({
          where: { idPelanggan: data.username }
        })
      }

      // 3. Update Pelanggan with mixRadiusId if found and not linked
      if (pelanggan && pelanggan.mixRadiusId !== data.id) {
        await prisma.pelanggan.update({
          where: { id: pelanggan.id },
          data: {
            mixRadiusId: data.id,
            lastSyncedAt: new Date()
          }
        })
        linkedToPelanggan = true
        // console.log(`[MixRadiusSync] Linked customer ${data.username} to Pelanggan table.`)
      } else if (pelanggan) {
        // Already linked, just update timestamp
        await prisma.pelanggan.update({
          where: { id: pelanggan.id },
          data: { lastSyncedAt: new Date() }
        })
        linkedToPelanggan = true
      }
    } catch (err) {
      console.warn(`[MixRadiusSync] Failed to link to Pelanggan table: ${err instanceof Error ? err.message : "Terjadi kesalahan"}`)
    }

    return { action: "synced", customer: result, linked: linkedToPelanggan }
  }

  /**
   * Sync all customers from MixRadius to populate status and expiry dates.
   */
  async syncAllCustomers() {
    try {
      const service = getMixRadiusService()
      const response = await service.fetchCustomersPPP({ length: 10000 })

      if (!response.data || !Array.isArray(response.data)) {
        return { success: true, count: 0 }
      }

      let count = 0
      for (const customer of response.data) {
        // Prepare data to be consistent with syncCustomer
        const customerData = {
          mixRadiusId: customer.id,
          username: customer.username,
          fullName: customer.fullname,
          ownerName: customer.owner_name,
          status: customer.auth_status,
          expiredOn: this.parseDate(customer.expired_on),
          lastSyncedAt: new Date(),
        }

        await prismaBilling.mixRadiusCustomer.upsert({
          where: { mixRadiusId: customer.id }, // Use mixRadiusId for reliability
          update: customerData,
          create: {
            id: randomUUID(),
            ...customerData
          }
        })
        count++
      }

      // console.log(`[MixRadiusSync] Successfully synced ${count} customers`)
      return { success: true, count }
    } catch (error) {
      console.error("[MixRadiusSync] Full customer sync error:", error)
      throw error
    }
  }

  /**
   * Sync invoices from MixRadius to Local Database.
   * Default to current month if dates not provided.
   */
  async syncInvoices(startDate?: string, endDate?: string) {
    try {
      const service = getMixRadiusService()

      // Default to current month if not provided
      const now = new Date()
      const start = startDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      const end = endDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${lastDay}`

      // console.log(`[MixRadiusSync] Syncing invoices from ${start} to ${end}`)

      const response = await service.fetchIncomeByPeriod({
        startDate: start,
        endDate: end,
        length: 10000, // Fetch all for the period
      })

      if (!response.data || !Array.isArray(response.data)) {
        // console.log("[MixRadiusSync] No invoices found for period")
        return { success: true, count: 0 }
      }

      let syncCount = 0
      for (const record of response.data) {
        try {
          await this.upsertInvoice(record)
          syncCount++
        } catch (err) {
          console.error(`[MixRadiusSync] Failed to sync invoice ${record.invoice}:`, err)
        }
      }

      // console.log(`[MixRadiusSync] Successfully synced ${syncCount} invoices`)
      return { success: true, count: syncCount }
    } catch (error) {
      console.error("[MixRadiusSync] Invoice sync error:", error)
      throw error
    }
  }

  private async upsertInvoice(record: MixRadiusIncomePeriodRecord) {
    const mixRadiusId = record.customer_id || record.username;

    // Ensure customer exists to satisfy foreign key constraint
    // Use mixRadiusId as primary key for upsert to handle username changes
    await prismaBilling.mixRadiusCustomer.upsert({
      where: { mixRadiusId: mixRadiusId },
      update: {
        username: record.username,
        fullName: record.fullname,
        ownerName: record.owner_name,
        lastSyncedAt: new Date()
      },
      create: {
        id: randomUUID(),
        mixRadiusId: mixRadiusId,
        username: record.username,
        fullName: record.fullname,
        ownerName: record.owner_name,
        address: record.address,
        phoneNumber: record.phonenumber,
        planName: record.plan_name,
        lastSyncedAt: new Date()
      }
    })

    // Remove formatting from price if any and convert to number
    const amount = parseFloat(record.total.replace(/[^0-9.-]+/g, "")) || 0
    const issuedDate = this.parseDate(record.renewed_on) || new Date()
    const expiredOn = this.parseDate(record.expired_on)

    const invoiceData = {
      mixRadiusId: record.id,
      username: record.username,
      fullName: record.fullname,
      planName: record.plan_name,
      amount: amount,
      status: record.trx_status.toUpperCase() === "SUCCESS" ? "PAID" : record.trx_status.toUpperCase(),
      paymentMethod: record.payment_method,
      issuedDate: issuedDate,
      dueDate: expiredOn,
      expiredOn: expiredOn,
      syncedAt: new Date(),
    }

    return await prismaBilling.mixRadiusInvoice.upsert({
      where: { invoiceNumber: record.invoice },
      update: invoiceData,
      create: {
        id: randomUUID(),
        invoiceNumber: record.invoice,
        ...invoiceData
      }
    })
  }

  async getNPLStatistics(groupId?: string) {
    const now = new Date();
    const service = getMixRadiusService();

    // 1. Resolve groupId to owners list
    let owners: string[] | null = null;
    if (groupId && groupId !== "all") {
      const group = await prismaBilling.mixRadiusOwnerGroup.findUnique({
        where: { id: groupId },
      });
      if (group && group.owners && group.owners.length > 0) {
        owners = group.owners.map(o => o.split(/[—–-]/)[0].trim().toLowerCase());
      }
    }

    // 2. Fetch data directly from MixRadius
    const response = await service.fetchCustomersPPP({ length: 10000 });
    const allCustomers = response.data || [];

    // 3. Filter and Calculate
    const stats = {
      under30: { count: 0, sum: 0 },
      between30And60: { count: 0, sum: 0 },
      between60And90: { count: 0, sum: 0 },
      over90: { count: 0, sum: 0 },
    };

    let totalCustomers = 0;

    // Pre-calculate average prices per plan for fallback estimation
    const planAverages = await prismaBilling.mixRadiusInvoice.groupBy({
      by: ["planName"],
      _avg: { amount: true },
      where: { amount: { gt: 0 } },
    });

    const planPriceMap = new Map<string, number>();
    planAverages.forEach((pa) => {
      if (pa.planName && pa._avg.amount) {
        planPriceMap.set(pa.planName, Number(pa._avg.amount));
      }
    });

    const globalAverageResult = await prismaBilling.mixRadiusInvoice.aggregate({
      _avg: { amount: true },
      where: { amount: { gt: 0 } },
    });
    const globalAverage = Number(globalAverageResult._avg.amount) || 150000;

    for (const customer of allCustomers) {
      // Site/Owner Filter
      if (owners && (!customer.owner_name || !owners.includes(customer.owner_name.toLowerCase().trim()))) {
        continue;
      }

      totalCustomers++;

      // NPL Filter
      const expiredDate = this.parseDate(customer.expired_on);
      const isExpired = expiredDate && expiredDate < now;
      const isNPL =
        customer.auth_status === "Disabled-Users" ||
        customer.auth_status === "Isolir" ||
        (customer.auth_status === "Enabled-Users" && isExpired);

      if (isNPL && expiredDate) {
        const diffTime = now.getTime() - expiredDate.getTime();
        const diffDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        // Estimate amount
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
