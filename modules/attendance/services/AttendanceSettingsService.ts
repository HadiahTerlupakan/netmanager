import { SettingsRepository } from '../repositories/SettingsRepository'

export class AttendanceSettingsService {
    private readonly settingsRepository = new SettingsRepository()

    async findByKey(key: string, tenantId?: string) {
        return this.settingsRepository.findByKey(key, tenantId)
    }

    async findManyByKeys(keys: string[]) {
        return this.settingsRepository.findManyByKeys(keys)
    }
}
