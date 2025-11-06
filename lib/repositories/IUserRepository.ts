import { Role } from '@prisma/client'

export interface UserSelect {
  id: boolean
  name: boolean
  email: boolean
  role: boolean
  createdAt: boolean
  passwordHash?: boolean
}

export interface UserCreateData {
  email: string
  name?: string | null
  passwordHash: string
  role: Role
}

export interface UserUpdateData {
  name?: string | null
  passwordHash?: string
  role?: Role
}

export interface UserPublic {
  id: string
  name: string | null
  email: string
  role: Role
  createdAt: Date
}

export interface UserWithPassword extends UserPublic {
  passwordHash: string
}

export interface IUserRepository {
  findAll(): Promise<UserPublic[]>
  findById(id: string): Promise<UserPublic | null>
  findByEmail(email: string): Promise<UserWithPassword | null>
  create(data: UserCreateData): Promise<{ id: string }>
  update(id: string, data: UserUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
  countByRole(role: Role): Promise<number>
}

