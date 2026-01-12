import type { PointClaim, PointClaimStatus } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import type { 
  IPointClaimRepository, 
  CreatePointClaimInput, 
  PointClaimWithRelations,
  PointSummary
} from '../repositories/IPointClaimRepository'
import { createNotification } from '../../notification/services/NotificationService'

export class PointClaimService {
  constructor(
    private readonly repository: IPointClaimRepository,
    private readonly db: PrismaClient
  ) {}

  /**
   * Submit claim poin oleh sales
   * - Validasi: canvasing harus sudah ada WO yang completed
   * - Lock canvasing setelah claim disubmit
   */
  async submitClaim(data: CreatePointClaimInput): Promise<PointClaim> {
    // 1. Check if canvasing exists and has completed WO
    const canvasing = await this.db.canvasing.findUnique({
      where: { id: data.canvasingId },
      include: {
        workOrder: true,
        pointClaims: true,
        sales: { select: { name: true } },
      },
    })

    if (!canvasing) {
      throw new Error('Canvasing tidak ditemukan')
    }

    if (canvasing.salesId !== data.salesId) {
      throw new Error('Anda tidak memiliki akses ke canvasing ini')
    }

    if (canvasing.isLocked) {
      throw new Error('Canvasing sudah dikunci, tidak bisa diubah')
    }

    if (!canvasing.workOrder) {
      throw new Error('Work Order belum dibuat untuk canvasing ini')
    }

    const completedStatuses = ['COMPLETED', 'VERIFIED', 'CLOSED']
    if (!completedStatuses.includes(canvasing.workOrder.status)) {
      throw new Error('Work Order belum selesai. Status saat ini: ' + canvasing.workOrder.status)
    }

    if (canvasing.pointClaims && canvasing.pointClaims.length > 0) {
      throw new Error('Claim sudah pernah diajukan untuk canvasing ini')
    }

    // 2. Create claim
    const claim = await this.repository.create(data)

    // 3. Lock canvasing
    await this.db.canvasing.update({
      where: { id: data.canvasingId },
      data: { isLocked: true },
    })

    // 4. Notify admins about new claim
    const salesName = canvasing.sales?.name || 'Sales'
    createNotification({
      type: 'ANNOUNCEMENT',
      priority: 'NORMAL',
      title: '🎁 Claim Poin Baru',
      message: `${salesName} mengajukan claim +${claim.pointValue} poin untuk canvasing ${canvasing.nama}`,
      link: `/admin/marketing/canvasing/${canvasing.id}`,
      sourceType: 'POINT_CLAIM',
      sourceId: claim.id,
    }).catch(err => console.error('[PointClaim Notif] Error:', err))

    return claim
  }

  async getClaimById(id: string): Promise<PointClaimWithRelations | null> {
    return this.repository.findById(id)
  }

  async getClaimByCanvasingId(canvasingId: string): Promise<PointClaim | null> {
    return this.repository.findByCanvasingId(canvasingId)
  }

  async getAllClaims(filters?: { 
    status?: PointClaimStatus
    salesId?: string 
  }): Promise<PointClaimWithRelations[]> {
    return this.repository.findAll(filters)
  }

  async getPointSummary(salesId: string): Promise<PointSummary> {
    return this.repository.getPointSummaryBySales(salesId)
  }

  /**
   * Admin approve claim
   */
  async approveClaim(id: string, reviewerId: string, notes?: string): Promise<PointClaim> {
    const claim = await this.repository.findById(id)
    if (!claim) {
      throw new Error('Claim tidak ditemukan')
    }

    if (claim.status !== 'PENDING') {
      throw new Error('Hanya claim dengan status PENDING yang bisa disetujui')
    }

    const approved = await this.repository.update(id, {
      status: 'APPROVED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes,
    })

    // Notify sales that claim was approved
    createNotification({
      type: 'ANNOUNCEMENT',
      priority: 'NORMAL',
      title: '⭐ Claim Poin Disetujui',
      message: `Claim poin +${claim.pointValue} poin berhasil disetujui!`,
      link: `/marketing/canvasing/${claim.canvasingId}`,
      userId: claim.salesId,
      sourceType: 'POINT_CLAIM',
      sourceId: id,
    }).catch(err => console.error('[PointClaim Notif] Error:', err))

    return approved
  }

  /**
   * Admin reject claim
   */
  async rejectClaim(id: string, reviewerId: string, notes: string): Promise<PointClaim> {
    const claim = await this.repository.findById(id)
    if (!claim) {
      throw new Error('Claim tidak ditemukan')
    }

    if (claim.status !== 'PENDING') {
      throw new Error('Hanya claim dengan status PENDING yang bisa ditolak')
    }

    if (!notes || notes.trim() === '') {
      throw new Error('Alasan penolakan wajib diisi')
    }

    // Unlock canvasing when claim is rejected so sales can re-submit
    await this.db.canvasing.update({
      where: { id: claim.canvasingId },
      data: { isLocked: false },
    })

    // Notify sales that claim was rejected
    createNotification({
      type: 'ANNOUNCEMENT',
      priority: 'NORMAL',
      title: '❌ Claim Poin Ditolak',
      message: `Claim poin ditolak. Alasan: ${notes}`,
      link: `/marketing/canvasing/${claim.canvasingId}`,
      userId: claim.salesId,
      sourceType: 'POINT_CLAIM',
      sourceId: id,
    }).catch(err => console.error('[PointClaim Notif] Error:', err))

    // Delete the rejected claim so sales can create new one
    await this.repository.delete(id)

    // Return a placeholder claim object for response
    return {
      ...claim,
      status: 'REJECTED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: notes,
    }
  }

  /**
   * Delete claim (admin only, sebelum approved)
   */
  async deleteClaim(id: string): Promise<void> {
    const claim = await this.repository.findById(id)
    if (!claim) {
      throw new Error('Claim tidak ditemukan')
    }

    if (claim.status === 'APPROVED') {
      throw new Error('Claim yang sudah disetujui tidak bisa dihapus')
    }

    // Unlock canvasing
    await this.db.canvasing.update({
      where: { id: claim.canvasingId },
      data: { isLocked: false },
    })

    await this.repository.delete(id)
  }
}
