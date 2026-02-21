import type { Canvasing, CanvasingStatus } from '@prisma/client'
import type { ICanvasingRepository, CreateCanvasingInput, UpdateCanvasingInput, CanvasingWithSalesInfo } from '../repositories/ICanvasingRepository'
import type { IWorkOrderRepository } from '../../work-order/repositories/IWorkOrderRepository'
import type { IPointClaimRepository } from '../repositories/IPointClaimRepository'
import { socketEmitter } from '@/lib/websocket/emitter'
import { SOCKET_EVENTS } from '@/lib/websocket/types'
import { createNotification, notifyNewCanvasing } from '../../notification/services/NotificationService'

export class CanvasingService {
  constructor(
    private readonly repository: ICanvasingRepository,
    private readonly woRepository: IWorkOrderRepository,
    private readonly pointClaimRepository: IPointClaimRepository
  ) {}

  async createRequest(data: CreateCanvasingInput): Promise<CanvasingWithSalesInfo> {
    const canvasing = await this.repository.create(data)

    // Notify admins/managers with canvasing:verify permission
    notifyNewCanvasing({
      canvasingId: canvasing.id,
      customerName: canvasing.nama,
      salesId: canvasing.salesId,
      salesName: canvasing.sales?.name || undefined,
      siteId: canvasing.sales?.siteId,
    }).catch(err => console.error('[Canvasing Notif] Error:', err))

    return canvasing
  }

  async getRequestById(id: string): Promise<Canvasing | null> {
    return this.repository.findById(id)
  }

  async getAllRequests(filters?: { status?: CanvasingStatus; salesId?: string; siteId?: string }): Promise<Canvasing[]> {
    return this.repository.findAll(filters)
  }

  async updateRequest(id: string, data: UpdateCanvasingInput): Promise<Canvasing> {
    return this.repository.update(id, data)
  }

  async approveRequest(id: string, approverId: string): Promise<Canvasing> {
    // Use findByIdWithSales to get sales user with site info
    const request = await this.repository.findByIdWithSales(id)
    if (!request) throw new Error('Request tidak ditemukan')
    if (request.status !== 'PENDING') throw new Error('Hanya request PENDING yang bisa disetujui')

    // 1. Generate WO Number
    const woNumber = await this.woRepository.generateWorkOrderNumber()

    // 2. Build description with all details
    const descriptionParts = [
      `Canvasing Approved`,
      `Pelanggan: ${request.nama}`,
      `Paket: ${request.paket}`,
      request.odp ? `ODP: ${request.odp}` : null,
    ].filter(Boolean)

    // 3. Create Work Order with full data
    const workOrder = await this.woRepository.create({
      workOrderNumber: woNumber,
      title: `Instalasi Baru - ${request.nama}`,
      description: descriptionParts.join('. '),
      priority: 'NORMAL',
      type: 'INSTALLATION',
      // Site from sales user
      ...(request.sales?.siteId ? { siteId: request.sales.siteId } : {}),
      // Contact info
      contactName: request.nama,
      contactPhone: request.noTelpon,
      // Location
      locationAddress: request.alamat,
      ...(request.foto ? { fotoRumah: request.foto } : {}),
      ...(request.fotoKtp ? { fotoKtp: request.fotoKtp } : {}),
      ...(request.latitude ? { locationLat: request.latitude } : {}),
      ...(request.longitude ? { locationLng: request.longitude } : {}),
      createdById: approverId,
    })

    // 4. Create Tasks Checklist
    const tasks = [
      { title: `Kabel ${request.kabel} meter`, description: 'Tarik kabel dari ODP ke rumah pelanggan', order: 1 },
    ]

    // Add SN ONT task if SN provided
    if (request.sn) {
      tasks.push({ title: `SN ONT: ${request.sn}`, description: 'Pasang ONT dengan SN yang sudah ditentukan', order: 2 })
    }

    // Standard installation tasks
    tasks.push(
      { title: 'Pasang Modem/Router', description: 'Setting dan pasang perangkat CPE', order: request.sn ? 3 : 2 },
      { title: 'Test Koneksi', description: 'Verifikasi koneksi internet berjalan dengan baik', order: request.sn ? 4 : 3 }
    )

    // Create all tasks
    for (const task of tasks) {
      await this.woRepository.addTask({
        workOrderId: workOrder.id,
        ...task
      })
    }

    // 5. Update Canvasing status
    socketEmitter.notifyUser(request.salesId, {
      title: 'Canvasing Disetujui',
      message: `Canvasing ${request.nama} disetujui, SPK Pemasangan sedang dibuat!`,
      type: 'SUCCESS',
      id: crypto.randomUUID(),
      priority: 'NORMAL',
      createdAt: new Date().toISOString()
    })
    const approved = await this.repository.update(id, {
      status: 'APPROVED',
      approvedBy: approverId,
      approvedAt: new Date(),
      workOrderId: workOrder.id
    })

    // Note: PointClaim is now created at the COMPLETE stage, not here.

    // 6. Notify sales that canvasing was approved
    if (request.salesId) {
      createNotification({
        type: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        title: '✅ Canvasing Disetujui',
        message: `Canvasing untuk ${request.nama} disetujui. WO #${woNumber} telah dibuat.`,
        link: `/admin/marketing/canvasing/${id}`,
        userId: request.salesId,
        sourceType: 'CANVASING',
        sourceId: id,
      }).catch(err => console.error('[Canvasing Notif] Error:', err))
    }

    return approved
  }

  async rejectRequest(id: string, rejectReason?: string): Promise<Canvasing> {
    // Get request to notify sales
    const request = await this.repository.findById(id)
    
    const rejected = await this.repository.update(id, { status: 'REJECTED', rejectReason: rejectReason || null })
    
    socketEmitter.notifyUser(request.salesId, {
      title: 'Canvasing Ditolak',
      message: `Canvasing ${request.nama} ditolak. Alasan: ${rejectReason}`,
      type: 'ERROR',
      id: crypto.randomUUID(),
      priority: 'NORMAL',
      createdAt: new Date().toISOString()
    })

    // Notify sales that canvasing was rejected
    if (request?.salesId) {
      createNotification({
        type: 'ANNOUNCEMENT',
        priority: 'NORMAL',
        title: '❌ Canvasing Ditolak',
        message: `Canvasing untuk ${request.nama} ditolak.`,
        link: `/admin/marketing/canvasing/${id}`,
        userId: request.salesId,
        sourceType: 'CANVASING',
        sourceId: id,
      }).catch(err => console.error('[Canvasing Notif] Error:', err))
    }

    return rejected
  }

  async deleteRequest(id: string): Promise<void> {
    return this.repository.delete(id)
  }

  async cancelApproval(id: string): Promise<Canvasing> {
    const request = await this.repository.findById(id)
    if (!request) throw new Error('Request tidak ditemukan')
    if (request.status !== 'APPROVED') throw new Error('Hanya canvasing APPROVED yang bisa dibatalkan')

    // Reset to PENDING and unlink from WO
    return this.repository.update(id, {
      status: 'PENDING',
      workOrderId: null,
      approvedBy: null,
      approvedAt: null
    })
  }

  async markAsInstalled(id: string): Promise<Canvasing> {
    const request = await this.repository.findById(id)
    if (!request) throw new Error('Request tidak ditemukan')
    
    const installed = await this.repository.update(id, {
      status: 'INSTALASI',
    })

    // Emit to sales that installation is done
    socketEmitter.notifyUser(installed.salesId, {
      title: 'Pemasangan Selesai',
      message: `Teknisi telah memasang perangkat untuk canvasing ${installed.nama}. Silakan lakukan laporan!`,
      type: 'INFO',
      id: crypto.randomUUID(),
      priority: 'NORMAL',
      createdAt: new Date().toISOString()
    })
    
    // Also notify admins to update dashboard
    // Notify admins via broadcast or specific method
    socketEmitter.broadcast('canvasing:update', installed)

    return installed
  }

  async completeCanvasing(id: string, salesId: string, fotoInstalasi: string, sn?: string): Promise<Canvasing> {
    const request = await this.repository.findById(id)
    if (!request) throw new Error('Request tidak ditemukan')
    if (request.salesId !== salesId) throw new Error('Hanya sales pembuat yang bisa menyelesaikan canvasing')
    if (request.status !== 'INSTALASI') throw new Error('Canvasing belum pada tahap instalasi')

    const dataToUpdate: any = {
      status: 'COMPLETE',
      fotoInstalasi
    }
    if (sn) dataToUpdate.sn = sn

    const completed = await this.repository.update(id, dataToUpdate)

    // Notify admins
    socketEmitter.notifyAdmins({
      title: 'Canvasing Complete',
      message: `Sales telah melaporkan selesai untuk canvasing ${completed.nama}.`,
      type: 'INFO',
      id: crypto.randomUUID(),
      priority: 'NORMAL',
      createdAt: new Date().toISOString()
    })
    socketEmitter.broadcast('canvasing:update', completed)

    return completed
  }

  async claimCommission(id: string, salesId: string): Promise<Canvasing> {
    const request = await this.repository.findById(id)
    if (!request) throw new Error('Request tidak ditemukan')
    if (request.salesId !== salesId) throw new Error('Hanya sales pembuat yang bisa melakukan claim')
    if (request.status !== 'COMPLETE') throw new Error('Canvasing harus berstatus COMPLETE untuk diclaim')

    const claimed = await this.repository.update(id, {
      status: 'CLAIM',
    })

    // Create PointClaim for Sales
    await this.pointClaimRepository.create({
      salesId: request.salesId,
      canvasingId: id,
      buktiUrls: request.foto ? [request.foto] : [],
      keterangan: `Komisi otomatis Canvasing: ${request.nama}`
    })

    socketEmitter.broadcast('canvasing:update', claimed)
    return claimed
  }
}
