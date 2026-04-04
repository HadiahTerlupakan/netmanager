import { UserRepository } from './UserRepository'
import type { IUserRepository } from './IUserRepository'
import { OtbRepository } from '@/modules/network/repositories'
import type { IOtbRepository } from '@/modules/network/repositories'
import { OdcRepository } from '@/modules/network/repositories'
import type { IOdcRepository } from '@/modules/network/repositories'
import { OdpRepository } from '@/modules/network/repositories'
import type { IOdpRepository } from '@/modules/network/repositories'
import { JoinboxRepository } from '@/modules/network/repositories'
import type { IJoinboxRepository } from '@/modules/network/repositories'
import { PoleRepository } from '@/modules/network/repositories'
import type { IPoleRepository } from '@/modules/network/repositories'
import { KmzRepository } from '@/modules/network/repositories'
import type { IKmzRepository } from '@/modules/network/repositories'
import { MikroTikRouterRepository } from '@/modules/network/repositories'
import type { IMikroTikRouterRepository } from '@/modules/network/repositories'
import { RadiusRepository } from '@/modules/network/repositories/RadiusRepository'
import type { IRadiusRepository } from '@/modules/network/repositories/IRadiusRepository'
import { InventoryRepository } from '@/modules/inventory'
import type { IInventoryRepository } from '@/modules/inventory'
import type { IPengeluaranRepository, IPemasukanRepository } from '@/modules/finance/repositories'
import { PengeluaranRepository, PemasukanRepository } from '@/modules/finance/repositories'
import { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'
import type { IWorkOrderRepository } from '@/modules/work-order/repositories/IWorkOrderRepository'
import { CanvasingRepository } from '@/modules/marketing/repositories/CanvasingRepository'
import type { ICanvasingRepository } from '@/modules/marketing/repositories/ICanvasingRepository'
import { CanvasingService } from '@/modules/marketing/services/CanvasingService'
import { PointClaimRepository } from '@/modules/marketing/repositories/PointClaimRepository'
import type { IPointClaimRepository } from '@/modules/marketing/repositories/IPointClaimRepository'
import { PointClaimService } from '@/modules/marketing/services/PointClaimService'
import { AttendanceRepository } from '@/modules/attendance/repositories/AttendanceRepository'
import { prisma, prismaAuth } from '@/lib/prisma'

let userRepositoryInstance: IUserRepository | null = null
let otbRepositoryInstance: IOtbRepository | null = null
let odcRepositoryInstance: IOdcRepository | null = null
let odpRepositoryInstance: IOdpRepository | null = null
let joinboxRepositoryInstance: IJoinboxRepository | null = null
let poleRepositoryInstance: IPoleRepository | null = null
let kmzRepositoryInstance: IKmzRepository | null = null
let mikroTikRouterRepositoryInstance: IMikroTikRouterRepository | null = null
let pengeluaranRepositoryInstance: IPengeluaranRepository | null = null
let pemasukanRepositoryInstance: IPemasukanRepository | null = null

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new UserRepository(prismaAuth)
  }
  return userRepositoryInstance
}

export function getOtbRepository(): IOtbRepository {
  if (!otbRepositoryInstance) {
    otbRepositoryInstance = new OtbRepository()
  }
  return otbRepositoryInstance
}

export function getOdcRepository(): IOdcRepository {
  if (!odcRepositoryInstance) {
    odcRepositoryInstance = new OdcRepository()
  }
  return odcRepositoryInstance
}

export function getOdpRepository(): IOdpRepository {
  if (!odpRepositoryInstance) {
    odpRepositoryInstance = new OdpRepository()
  }
  return odpRepositoryInstance
}

export function getJoinboxRepository(): IJoinboxRepository {
  if (!joinboxRepositoryInstance) {
    joinboxRepositoryInstance = new JoinboxRepository()
  }
  return joinboxRepositoryInstance
}

export function getPoleRepository(): IPoleRepository {
  if (!poleRepositoryInstance) {
    poleRepositoryInstance = new PoleRepository()
  }
  return poleRepositoryInstance
}

export function getKmzRepository(): IKmzRepository {
  if (!kmzRepositoryInstance) {
    kmzRepositoryInstance = new KmzRepository()
  }
  return kmzRepositoryInstance
}

export function getMikroTikRouterRepository(): IMikroTikRouterRepository {
  if (!mikroTikRouterRepositoryInstance) {
    mikroTikRouterRepositoryInstance = new MikroTikRouterRepository()
  }
  return mikroTikRouterRepositoryInstance
}

let radiusRepositoryInstance: IRadiusRepository | null = null

export function getRadiusRepository(): IRadiusRepository {
  if (!radiusRepositoryInstance) {
    radiusRepositoryInstance = new RadiusRepository(prisma)
  }
  return radiusRepositoryInstance
}

export function getPengeluaranRepository(): IPengeluaranRepository {
  if (!pengeluaranRepositoryInstance) {
    pengeluaranRepositoryInstance = new PengeluaranRepository()
  }
  return pengeluaranRepositoryInstance
}

export function getPemasukanRepository(): IPemasukanRepository {
  if (!pemasukanRepositoryInstance) {
    pemasukanRepositoryInstance = new PemasukanRepository()
  }
  return pemasukanRepositoryInstance
}

export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
export { OtbRepository } from '@/modules/network/repositories'
export type { IOtbRepository, OtbCreateData, OtbUpdateData, OtbPublic } from '@/modules/network/repositories'
export { OdcRepository } from '@/modules/network/repositories'
export type { IOdcRepository, OdcCreateData, OdcUpdateData, OdcPublic } from '@/modules/network/repositories'
export { OdpRepository } from '@/modules/network/repositories'
export type { IOdpRepository, OdpCreateData, OdpUpdateData, OdpPublic } from '@/modules/network/repositories'
export { JoinboxRepository } from '@/modules/network/repositories'
export type { IJoinboxRepository, JoinboxCreateData, JoinboxUpdateData, JoinboxPublic } from '@/modules/network/repositories'
export { PoleRepository } from '@/modules/network/repositories'
export type { IPoleRepository, PoleCreateData, PoleUpdateData, PolePublic } from '@/modules/network/repositories'
export { KmzRepository } from '@/modules/network/repositories'
export type { IKmzRepository, KmzFileCreateData, KmzFileUpdateData, KmzFilePublic } from '@/modules/network/repositories'
export { MikroTikRouterRepository } from '@/modules/network/repositories'
export type { IMikroTikRouterRepository, MikroTikRouterCreateData, MikroTikRouterUpdateData, MikroTikRouterPublic, MikroTikRouterStatistics } from '@/modules/network/repositories'
export { RadiusRepository } from '@/modules/network/repositories/RadiusRepository'
export type { IRadiusRepository } from '@/modules/network/repositories/IRadiusRepository'
export { PengeluaranRepository } from '@/modules/finance/repositories'
export type { IPengeluaranRepository, PengeluaranCreateData, PengeluaranUpdateData, PengeluaranPublic } from '@/modules/finance/repositories'
export { PemasukanRepository } from '@/modules/finance/repositories'
export type { IPemasukanRepository, PemasukanCreateData, PemasukanUpdateData, PemasukanPublic } from '@/modules/finance/repositories'
export { InventoryRepository } from '@/modules/inventory'
export type { IInventoryRepository, CreateBarangInput, UpdateBarangInput, CreateBarangMasukInput, CreateBarangKeluarInput, BarangWithStock } from '@/modules/inventory'
export { WorkOrderRepository } from '@/modules/work-order/repositories/WorkOrderRepository'
export type { IWorkOrderRepository, WorkOrderWithRelations, CreateWorkOrderData, UpdateWorkOrderData } from '@/modules/work-order/repositories/IWorkOrderRepository'
export { CanvasingRepository } from '@/modules/marketing/repositories/CanvasingRepository'
export type { ICanvasingRepository } from '@/modules/marketing/repositories/ICanvasingRepository'
export { CanvasingService } from '@/modules/marketing/services/CanvasingService'
export { PointClaimRepository } from '@/modules/marketing/repositories/PointClaimRepository'
export type { IPointClaimRepository } from '@/modules/marketing/repositories/IPointClaimRepository'
export { PointClaimService } from '@/modules/marketing/services/PointClaimService'

let inventoryRepositoryInstance: IInventoryRepository | null = null

export function getInventoryRepository(): IInventoryRepository {
  if (!inventoryRepositoryInstance) {
    inventoryRepositoryInstance = new InventoryRepository() as unknown as IInventoryRepository
  }
  return inventoryRepositoryInstance
}

let workOrderRepositoryInstance: IWorkOrderRepository | null = null

export function getWorkOrderRepository(): IWorkOrderRepository {
  if (!workOrderRepositoryInstance) {
    workOrderRepositoryInstance = new WorkOrderRepository(prisma)
  }
  return workOrderRepositoryInstance
}

let attendanceRepositoryInstance: AttendanceRepository | null = null

export function getAttendanceRepository(): AttendanceRepository {
  if (!attendanceRepositoryInstance) {
    attendanceRepositoryInstance = new AttendanceRepository()
  }
  return attendanceRepositoryInstance
}

let canvasingRepositoryInstance: ICanvasingRepository | null = null
let canvasingServiceInstance: CanvasingService | null = null

export function getCanvasingRepository(): ICanvasingRepository {
  if (!canvasingRepositoryInstance) {
    canvasingRepositoryInstance = new CanvasingRepository(prisma)
  }
  return canvasingRepositoryInstance
}

export function getCanvasingService(): CanvasingService {
  if (!canvasingServiceInstance) {
    canvasingServiceInstance = new CanvasingService(
      getCanvasingRepository(),
      getWorkOrderRepository()
    )
  }
  return canvasingServiceInstance
}

let pointClaimRepositoryInstance: IPointClaimRepository | null = null
let pointClaimServiceInstance: PointClaimService | null = null

export function getPointClaimRepository(): IPointClaimRepository {
  if (!pointClaimRepositoryInstance) {
    pointClaimRepositoryInstance = new PointClaimRepository(prisma)
  }
  return pointClaimRepositoryInstance
}

export function getPointClaimService(): PointClaimService {
  if (!pointClaimServiceInstance) {
    pointClaimServiceInstance = new PointClaimService(
      getPointClaimRepository(),
      prisma
    )
  }
  return pointClaimServiceInstance
}
