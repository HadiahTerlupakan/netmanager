export interface UserSelect {
  id: boolean
  name: boolean
  email: boolean
  phone?: boolean
  departmentId?: boolean
  siteId?: boolean
  isActive?: boolean
  createdAt: boolean
  passwordHash?: boolean
}

export interface UserCreateData {
  email: string
  name?: string | null
  passwordHash: string
  phone?: string | null
  departmentId?: string | null
  siteId?: string | null
  isActive?: boolean
}

export interface UserUpdateData {
  name?: string | null
  image?: string | null
  passwordHash?: string
  phone?: string | null
  departmentId?: string | null
  siteId?: string | null
  isActive?: boolean
}

export interface UserPublic {
  id: string
  name: string | null
  email: string
  image: string | null
  phone: string | null
  departmentId: string | null
  siteId: string | null
  isActive: boolean
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
  findManyWithFullDetails(userIds: string[]): Promise<Array<{ id: string; name: string | null; image: string | null; sites: { name: string } | null; departments: { name: string } | null }>>
}
