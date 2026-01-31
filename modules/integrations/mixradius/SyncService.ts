
import { prisma } from '@/lib/prisma'
import type { MixRadiusCustomerDetail } from './MixRadiusService'
import { randomUUID } from 'crypto'

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
      throw new Error('Username is required for sync')
    }

    console.log(`[MixRadiusSync] Syncing customer: ${data.username} (${data.id})`)

    // Prepare Data
    const customerData = {
      mixRadiusId: data.id,
      username: data.username,
      fullName: data.fullname || data.username,
      address: data.address,
      phoneNumber: data.phonenumber,
      planName: data.plan_name,
      status: data.auth_status,
      expiredOn: this.parseDate(data.expired_on),
      lastSyncedAt: new Date(),
    }

    // Upsert into MixRadiusCustomer
    const result = await prisma.mixRadiusCustomer.upsert({
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
        console.log(`[MixRadiusSync] Linked customer ${data.username} to Pelanggan table.`)
      } else if (pelanggan) {
        // Already linked, just update timestamp
        await prisma.pelanggan.update({
          where: { id: pelanggan.id },
          data: { lastSyncedAt: new Date() }
        })
        linkedToPelanggan = true
      }
    } catch (err) {
      console.warn(`[MixRadiusSync] Failed to link to Pelanggan table: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    return { action: 'synced', customer: result, linked: linkedToPelanggan }
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || dateStr === '0000-00-00 00:00:00') return null
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }
}

export const syncService = new MixRadiusSyncService()
