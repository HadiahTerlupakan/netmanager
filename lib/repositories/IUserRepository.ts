export interface UserSelect {
  id: boolean
  name: boolean
  email: boolean
  createdAt: boolean
  passwordHash?: boolean
}

export interface UserCreateData {
  email: string
  name?: string | null
  passwordHash: string
}

export interface UserUpdateData {
  name?: string | null
  passwordHash?: string
}

export interface UserPublic {
  id: string
  name: string | null
  email: string
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
}
