import type { Canvasing, CanvasingStatus } from '@prisma/client'
import type { ICanvasingRepository, CreateCanvasingInput, UpdateCanvasingInput } from '../repositories/ICanvasingRepository'
import type { IWorkOrderRepository } from '../../work-order/repositories/IWorkOrderRepository'

export class CanvasingService {
  constructor(
    private readonly repository: ICanvasingRepository,
    private readonly woRepository: IWorkOrderRepository
  ) {}

  async createRequest(data: CreateCanvasingInput): Promise<Canvasing> {
    return this.repository.create(data)
  }

  async getRequestById(id: string): Promise<Canvasing | null> {
    return this.repository.findById(id)
  }

  async getAllRequests(filters?: { status?: CanvasingStatus; salesId?: string }): Promise<Canvasing[]> {
    return this.repository.findAll(filters)
  }

  async updateRequest(id: string, data: UpdateCanvasingInput): Promise<Canvasing> {
    return this.repository.update(id, data)
  }

  async approveRequest(id: string, approverId: string): Promise<Canvasing> {
    const request = await this.repository.findById(id)
    if (!request) throw new Error('Request tidak ditemukan')
    if (request.status !== 'PENDING') throw new Error('Hanya request PENDING yang bisa disetujui')

    // 1. Generate WO Number
    const woNumber = await this.woRepository.generateWorkOrderNumber()

    // 2. Create Work Order
    const workOrder = await this.woRepository.create({
      workOrderNumber: woNumber,
      title: `Instalasi Baru - ${request.nama}`,
      description: `Canvasing Approved. Alamat: ${request.alamat}. Paket: ${request.paket}. Kabel: ${request.kabel}m`,
      priority: 'NORMAL',
      type: 'INSTALLATION',
      siteId: '', // Default or from request if available
      createdById: approverId,
      // Mapping other fields if needed
    })

    // 3. Update Canvasing status
    return this.repository.update(id, {
      status: 'APPROVED',
      // @ts-ignore - approvedBy and workOrderId exist in schema now
      approvedBy: approverId,
      approvedAt: new Date(),
      workOrderId: workOrder.id
    })
  }

  async rejectRequest(id: string): Promise<Canvasing> {
    return this.repository.update(id, { status: 'REJECTED' })
  }

  async deleteRequest(id: string): Promise<void> {
    return this.repository.delete(id)
  }
}
