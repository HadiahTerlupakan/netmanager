import { UserRepository } from './UserRepository'
import { IUserRepository } from './IUserRepository'

let userRepositoryInstance: IUserRepository | null = null

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new UserRepository()
  }
  return userRepositoryInstance
}

export { UserRepository } from './UserRepository'
export type { IUserRepository, UserCreateData, UserUpdateData, UserPublic, UserWithPassword } from './IUserRepository'

