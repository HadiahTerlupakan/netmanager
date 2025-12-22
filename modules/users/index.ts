// Public API for Users Module
export { UserRepository } from './repositories/UserRepository'
export type { CreateUserDTO, UserWithRelations } from './repositories/UserRepository'

export { UserService, getUserService } from './services/UserService'
export type { CreateUserInput, UpdateUserInput } from './services/UserService'
