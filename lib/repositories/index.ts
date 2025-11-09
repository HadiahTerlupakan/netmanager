import { UserRepository } from './UserRepository'
import { IUserRepository } from './IUserRepository'
import { OLTRepository } from './OLTRepository'
import { IOLTRepository } from './IOLTRepository'
import { OtbRepository } from './OtbRepository'
import { IOtbRepository } from './IOtbRepository'
import { OdcRepository } from './OdcRepository'
import { IOdcRepository } from './IOdcRepository'
import { OdpRepository } from './OdpRepository'
import { IOdpRepository } from './IOdpRepository'
import { JoinboxRepository } from './JoinboxRepository'
import { IJoinboxRepository } from './IJoinboxRepository'
import { PoleRepository } from './PoleRepository'
import { IPoleRepository } from './IPoleRepository'
import { KmzRepository } from './KmzRepository'
import { IKmzRepository } from './IKmzRepository'
import { OnuRepository } from './OnuRepository'
import { IOnuRepository } from './IOnuRepository'
import { OnuTypeRepository } from './OnuTypeRepository'
import { IOnuTypeRepository } from './IOnuTypeRepository'

let userRepositoryInstance: IUserRepository | null = null
let oltRepositoryInstance: IOLTRepository | null = null
let otbRepositoryInstance: IOtbRepository | null = null
let odcRepositoryInstance: IOdcRepository | null = null
let odpRepositoryInstance: IOdpRepository | null = null
let joinboxRepositoryInstance: IJoinboxRepository | null = null
let poleRepositoryInstance: IPoleRepository | null = null
let kmzRepositoryInstance: IKmzRepository | null = null
let onuRepositoryInstance: IOnuRepository | null = null
let onuTypeRepositoryInstance: IOnuTypeRepository | null = null

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new UserRepository()
  }
  return userRepositoryInstance
}

export function getOLTRepository(): IOLTRepository {
  if (!oltRepositoryInstance) {
    oltRepositoryInstance = new OLTRepository()
  }
  return oltRepositoryInstance
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

export function getOnuRepository(): IOnuRepository {
  if (!onuRepositoryInstance) {
    onuRepositoryInstance = new OnuRepository()
  }
  return onuRepositoryInstance
}

export function getOnuTypeRepository(): IOnuTypeRepository {
  if (!onuTypeRepositoryInstance) {
    onuTypeRepositoryInstance = new OnuTypeRepository()
  }
  return onuTypeRepositoryInstance
}

export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
export { OLTRepository } from './OLTRepository'
export type { IOLTRepository, OLTCreateData, OLTUpdateData, OLTPublic } from './IOLTRepository'
export { OtbRepository } from './OtbRepository'
export type { IOtbRepository, OtbCreateData, OtbUpdateData, OtbPublic } from './IOtbRepository'
export { OdcRepository } from './OdcRepository'
export type { IOdcRepository, OdcCreateData, OdcUpdateData, OdcPublic } from './IOdcRepository'
export { OdpRepository } from './OdpRepository'
export type { IOdpRepository, OdpCreateData, OdpUpdateData, OdpPublic } from './IOdpRepository'
export { JoinboxRepository } from './JoinboxRepository'
export type { IJoinboxRepository, JoinboxCreateData, JoinboxUpdateData, JoinboxPublic } from './IJoinboxRepository'
export { PoleRepository } from './PoleRepository'
export type { IPoleRepository, PoleCreateData, PoleUpdateData, PolePublic } from './IPoleRepository'
export { KmzRepository } from './KmzRepository'
export type { IKmzRepository, KmzFileCreateData, KmzFileUpdateData, KmzFilePublic } from './IKmzRepository'
export { OnuRepository } from './OnuRepository'
export type { IOnuRepository, OnuCreateData, OnuUpdateData, OnuPublic } from './IOnuRepository'
export { OnuTypeRepository } from './OnuTypeRepository'
export type { IOnuTypeRepository, OnuTypeCreateData, OnuTypeUpdateData, OnuTypePublic } from './IOnuTypeRepository'

