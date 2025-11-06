import { UserRepository } from './UserRepository'
import { IUserRepository } from './IUserRepository'
import { OLTRepository } from './OLTRepository'
import { IOLTRepository } from './IOLTRepository'
import { OtbRepository } from './OtbRepository'
import { IOtbRepository } from './IOtbRepository'

let userRepositoryInstance: IUserRepository | null = null
let oltRepositoryInstance: IOLTRepository | null = null
let otbRepositoryInstance: IOtbRepository | null = null

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

export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
export { OLTRepository } from './OLTRepository'
export type { IOLTRepository, OLTCreateData, OLTUpdateData, OLTPublic } from './IOLTRepository'
export { OtbRepository } from './OtbRepository'
export type { IOtbRepository, OtbCreateData, OtbUpdateData, OtbPublic } from './IOtbRepository'

