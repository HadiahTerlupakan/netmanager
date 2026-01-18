import type { Canvasing, CanvasingStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'

export interface CreateCanvasingInput {
  nama: string
  noKtp: string
  noTelpon: string
  email?: string | null
  alamat: string
  kabel: number
  odp?: string | null
  paket: string
  sn?: string | null
  latitude?: number | null
  longitude?: number | null
  foto?: string | null
  fotoKtp?: string | null
  salesId: string
}

export interface UpdateCanvasingInput {
  nama?: string
  noKtp?: string
  noTelpon?: string
  email?: string | null
  alamat?: string
  kabel?: number
  odp?: string | null
  paket?: string
  sn?: string | null
  status?: CanvasingStatus
  foto?: string | null
  fotoKtp?: string | null
}

export interface CanvasingWithSalesSite extends Canvasing {
  sales: {
    id: string
    name: string | null
    email: string | null
    siteId: string | null
    sites: {
      id: string
      name: string
    } | null
  }
}

export interface ICanvasingRepository {
  create(data: CreateCanvasingInput): Promise<Canvasing>
  findById(id: string): Promise<Canvasing | null>
  findByIdWithSales(id: string): Promise<CanvasingWithSalesSite | null>
  findAll(filters?: { status?: CanvasingStatus; salesId?: string; siteId?: string }): Promise<Canvasing[]>
  update(id: string, data: UpdateCanvasingInput): Promise<Canvasing>
  delete(id: string): Promise<void>
}
