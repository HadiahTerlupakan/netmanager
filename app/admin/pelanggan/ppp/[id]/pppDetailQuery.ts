import { PelangganAdminQueryService } from '@/modules/pelanggan'

const queryService = new PelangganAdminQueryService()

export async function getPppDetailViewModel(id: string) {
  return queryService.getPppDetail(id)
}
