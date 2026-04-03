import { prisma } from '@/lib/prisma'

export class SettingsRepository {
    /**
     * Find a setting by key and optional tenantId.
     */
    async findByKey(key: string, tenantId?: string) {
        return prisma.settings.findFirst({
            where: {
                key,
                ...(tenantId && { tenantId })
            }
        })
    }

    /**
     * Find multiple settings by an array of keys.
     */
    async findManyByKeys(keys: string[]) {
        return prisma.settings.findMany({
            where: { key: { in: keys } }
        })
    }
}
