import { UserRepository } from './UserRepository'
import { IUserRepository } from './IUserRepository'
import { OLTRepository } from './OLTRepository'
import { IOLTRepository } from './IOLTRepository'

let userRepositoryInstance: IUserRepository | null = null
let oltRepositoryInstance: IOLTRepository | null = null

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

export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'
export { OLTRepository } from './OLTRepository'
export type { IOLTRepository, OLTCreateData, OLTUpdateData, OLTPublic } from './IOLTRepository'

