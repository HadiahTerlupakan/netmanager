import { PelangganRepository } from '../repositories/PelangganRepository'

export class PelangganPushTokenService {
  private pelangganRepo = new PelangganRepository()

  findManyWithPushToken(tokens: string[]) {
    return this.pelangganRepo.findManyWithPushToken(tokens)
  }

  clearPushTokens(tokens: string[]) {
    return this.pelangganRepo.clearPushTokens(tokens)
  }

  findByIdWithPushToken(pelangganId: string) {
    return this.pelangganRepo.findByIdWithPushToken(pelangganId)
  }
}
