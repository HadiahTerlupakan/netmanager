export interface MikroTikRouterCreateData {
  name: string
  ipAddress: string
  timezone?: string
  apiPort?: number
  apiUsername: string
  apiPassword: string
  authPort?: number
  accountingPort?: number
  secretRadius: string
  isolirUrl?: string | null
  description?: string | null
}

export interface MikroTikRouterUpdateData {
  name?: string
  ipAddress?: string
  timezone?: string
  apiPort?: number
  apiUsername?: string
  apiPassword?: string
  authPort?: number
  accountingPort?: number
  secretRadius?: string
  isolirUrl?: string | null
  description?: string | null
  pingStatus?: string
  userOnline?: number
  lastStatusCheck?: Date | null
}

export interface MikroTikRouterPublic {
  id: string
  name: string
  ipAddress: string
  timezone: string
  apiPort: number
  apiUsername: string
  apiPassword: string
  authPort: number
  accountingPort: number
  secretRadius: string
  isolirUrl: string | null
  description: string | null
  pingStatus: string
  userOnline: number
  lastStatusCheck: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface IMikroTikRouterRepository {
  findAll(): Promise<MikroTikRouterPublic[]>
  findById(id: string): Promise<MikroTikRouterPublic | null>
  create(data: MikroTikRouterCreateData): Promise<{ id: string }>
  update(id: string, data: MikroTikRouterUpdateData): Promise<void>
  delete(id: string): Promise<void>
  count(): Promise<number>
}

