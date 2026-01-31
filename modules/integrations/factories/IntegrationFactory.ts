/**
 * IntegrationFactory
 *
 * Factory pattern for creating integration configurations.
 */

export interface CreateIntegrationConfigInput {
    name: string
    baseUrl: string
    username: string
    password: string
    isActive: boolean
}

export class IntegrationFactory {
    /**
     * Create MixRadius integration config
     */
    static createMixRadiusConfig(dto: {
        name: string
        baseUrl: string
        username: string
        password: string
    }): CreateIntegrationConfigInput {
        // Ensure URL is properly formatted
        let baseUrl = dto.baseUrl.trim()
        if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
            baseUrl = `https://${baseUrl}`
        }
        // Remove trailing slash
        baseUrl = baseUrl.replace(/\/$/, '')

        return {
            name: dto.name,
            baseUrl,
            username: dto.username,
            password: dto.password,
            isActive: false, // Start inactive, user must activate after testing
        }
    }

    /**
     * Create Radius server config
     */
    static createRadiusConfig(dto: {
        name: string
        serverIp: string
        authPort?: number
        acctPort?: number
        secret: string
    }): CreateIntegrationConfigInput {
        const authPort = dto.authPort ?? 1812
        const acctPort = dto.acctPort ?? 1813

        return {
            name: dto.name,
            baseUrl: `radius://${dto.serverIp}:${authPort}`,
            username: `auth:${authPort},acct:${acctPort}`,
            password: dto.secret,
            isActive: false,
        }
    }

    /**
     * Create webhook integration config
     */
    static createWebhookConfig(dto: {
        name: string
        webhookUrl: string
        secretKey?: string
    }): CreateIntegrationConfigInput {
        return {
            name: dto.name,
            baseUrl: dto.webhookUrl,
            username: 'webhook',
            password: dto.secretKey ?? '',
            isActive: false,
        }
    }

    /**
     * Create external API integration config
     */
    static createApiConfig(dto: {
        name: string
        apiUrl: string
        apiKey: string
        apiSecret?: string
    }): CreateIntegrationConfigInput {
        return {
            name: dto.name,
            baseUrl: dto.apiUrl,
            username: dto.apiKey,
            password: dto.apiSecret ?? '',
            isActive: false,
        }
    }

    /**
     * Validate integration URL
     */
    static validateUrl(url: string): { isValid: boolean; error?: string } {
        try {
            const parsed = new URL(url)
            if (!['http:', 'https:', 'radius:'].includes(parsed.protocol)) {
                return { isValid: false, error: 'Protocol tidak didukung' }
            }
            return { isValid: true }
        } catch {
            return { isValid: false, error: 'URL tidak valid' }
        }
    }
}
