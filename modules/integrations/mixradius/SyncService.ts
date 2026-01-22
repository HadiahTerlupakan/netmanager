
import { prisma } from '@/lib/prisma'
import { Status } from '@prisma/client'
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

    // 1. Resolve Harga Paket
    let hargaPaketId = await this.resolveHargaPaket(data.plan_name)
    if (!hargaPaketId) {
        throw new Error(`Cannot sync: No matching 'HargaPaket' found for plan '${data.plan_name}' and no fallback available.`)
    }

    // 2. Prepare Data
    // Parse dates (MixRadius format might vary, assuming ISO or string manageable by Date)
    // If dates are invalid, fallback to now or future
    const tanggalAktif = this.parseDate(data.created_at) || new Date()
    const jatuhTempo = this.parseDate(data.expired_on) || new Date(new Date().setDate(new Date().getDate() + 30))

    const pelangganData = {
      mixRadiusId: data.id,
      idPelanggan: data.username, // Username as ID Pelanggan
      username: data.username,
      // For password, we don't know the plain text if it's hashed, but MixRadius API returns it? 
      // If API returns plain, use it. If detailed API returns password, great.
      // Based on previous view, it returns 'password' field.
      password: data.password || '123456', 
      passwordLogin: data.password || '123456', // Default login password
      nama: data.fullname || data.username,
      alamat: data.address,
      noTelp: data.phonenumber,
      email: data.email,
      hargaPaketId: hargaPaketId,
      latitude: data.latitude ? parseFloat(data.latitude) : null,
      longitude: data.longitude ? parseFloat(data.longitude) : null,
      status: data.auth_status === 'active' || data.auth_status === 'accept' ? Status.AKTIF : Status.ISOLIR, // Map status
      tanggalAktif,
      jatuhTempo,
      catatan: data.note || 'Synced from MixRadius',
      lastSyncedAt: new Date(),
      updatedAt: new Date(),
    }

    // 3. Upsert
    // We prioritize matching by mixRadiusId, then by idPelanggan (username)
    
    // Check existing by mixRadiusId
    const existingByMixId = await prisma.pelanggan.findUnique({
      where: { mixRadiusId: data.id }
    })

    if (existingByMixId) {
      // Update
      const updated = await prisma.pelanggan.update({
        where: { id: existingByMixId.id },
        data: pelangganData
      })
      return { action: 'updated', customer: updated }
    }

    // Check existing by idPelanggan
    const existingByUsername = await prisma.pelanggan.findUnique({
      where: { idPelanggan: data.username }
    })

    if (existingByUsername) {
      // Link and Update
      const updated = await prisma.pelanggan.update({
        where: { id: existingByUsername.id },
        data: pelangganData
      })
      return { action: 'linked', customer: updated }
    }

    // Create New
    const created = await prisma.pelanggan.create({
      data: {
        id: randomUUID(),
        ...pelangganData
      }
    })
    return { action: 'created', customer: created }
  }

  /**
   * Helper to find suitable HargaPaket ID
   */
  private async resolveHargaPaket(planName: string): Promise<string | null> {
    if (!planName) return this.getFallbackPacket()

    // Try exact match
    const exact = await prisma.hargaPaket.findFirst({
      where: { 
        name: { equals: planName, mode: 'insensitive' }
      }
    })
    if (exact) return exact.id

    // Try partial match
    const partial = await prisma.hargaPaket.findFirst({
        where: { 
          name: { contains: planName, mode: 'insensitive' }
        }
      })
      if (partial) return partial.id

    return this.getFallbackPacket()
  }

  private async getFallbackPacket(): Promise<string | null> {
    const first = await prisma.hargaPaket.findFirst({
      where: { status: 'AKTIF' }
    })
    return first ? first.id : null
  }

  private parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr || dateStr === '0000-00-00 00:00:00') return null
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? null : d
  }
}

export const syncService = new MixRadiusSyncService()
