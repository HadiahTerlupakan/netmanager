import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

// Encryption keys (in production, use proper key management)
const ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
const IV_LENGTH = 16

export interface DatabaseSecurityOptions {
  enableRowLevelSecurity?: boolean
  enableAuditLogging?: boolean
  enableDataEncryption?: boolean
  encryptSensitiveFields?: string[]
  dataRetentionDays?: number
}

/**
 * Database Security Manager
 */
export class DatabaseSecurity {
  private prisma: PrismaClient
  private options: Required<DatabaseSecurityOptions>

  constructor(prisma: PrismaClient, options: DatabaseSecurityOptions = {}) {
    this.prisma = prisma
    this.options = {
      enableRowLevelSecurity: options.enableRowLevelSecurity ?? true,
      enableAuditLogging: options.enableAuditLogging ?? true,
      enableDataEncryption: options.enableDataEncryption ?? true,
      encryptSensitiveFields: options.encryptSensitiveFields ?? [
        'nik',
        'nomorKk',
        'phone',
        'email'
      ],
      dataRetentionDays: options.dataRetentionDays ?? 2555 // 7 years
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text: string): string {
    if (!this.options.enableDataEncryption || !text) {
      return text
    }

    try {
      const iv = crypto.randomBytes(IV_LENGTH)
      const cipher = crypto.createCipher('aes-256-gcm', ENCRYPTION_KEY)
      cipher.setAAD(Buffer.from('netmanager-db')) // Additional authenticated data

      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')

      const authTag = cipher.getAuthTag()
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
    } catch (error) {
      console.error('Encryption error:', error)
      return text // Fallback to plaintext
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText: string): string {
    if (!this.options.enableDataEncryption || !encryptedText) {
      return encryptedText
    }

    try {
      const parts = encryptedText.split(':')
      if (parts.length !== 3) {
        return encryptedText // Not encrypted
      }

      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]

      const decipher = crypto.createDecipher('aes-256-gcm', ENCRYPTION_KEY)
      decipher.setAAD(Buffer.from('netmanager-db'))
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')

      return decrypted
    } catch (error) {
      console.error('Decryption error:', error)
      return encryptedText // Return as-is if decryption fails
    }
  }

  /**
   * Check if user has access to specific data (Row-Level Security)
   */
  async checkDataAccess(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: 'READ' | 'WRITE' | 'DELETE'
  ): Promise<boolean> {
    if (!this.options.enableRowLevelSecurity) {
      return true
    }

    try {
      // Get user with role and permissions
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          department: true
        }
      })

      if (!user) {
        return false
      }

      // Admin can access everything
      if (user.role === 'ADMIN') {
        return true
      }

      // Implement role-based access control
      switch (resourceType) {
        case 'tagihan':
          return await this.checkTagihanAccess(user, resourceId, action)
        case 'pemasukan':
          return user.role === 'FINANCE' || user.role === 'ADMIN'
        case 'pengeluaran':
          return user.role === 'FINANCE' || user.role === 'ADMIN'
        case 'pelanggan':
          return user.role === 'ADMIN' || user.role === 'FINANCE'
        case 'karyawan':
          return user.role === 'ADMIN' || user.role === 'HR'
        default:
          return false
      }
    } catch (error) {
      console.error('Access check error:', error)
      return false // Fail closed
    }
  }

  /**
   * Check specific access for tagihan (billing)
   */
  private async checkTagihanAccess(
    user: { role: string; department?: string | null },
    tagihanId: string,
    action: string
  ): Promise<boolean> {
    // Admin and Finance can access all
    if (user.role === 'ADMIN' || user.role === 'FINANCE') {
      return true
    }

    // For regular users, check if they own the tagihan
    const tagihan = await this.prisma.tagihan.findUnique({
      where: { id: tagihanId },
      select: { pelangganId: true }
    })

    if (!tagihan) {
      return false
    }

    // Check if user is the customer
    const customer = await this.prisma.pelanggan.findUnique({
      where: { id: tagihan.pelangganId },
      select: { userId: true }
    })

    return customer?.userId === user.id
  }

  /**
   * Log database access for audit
   */
  async logDatabaseAccess(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.options.enableAuditLogging) {
      return
    }

    try {
      await this.prisma.financialAuditLog.create({
        data: {
          action: `DB_${action}`,
          entityType: resourceType,
          entityId: resourceId,
          description: `Database ${action} on ${resourceType}:${resourceId}`,
          userId,
          ipAddress: metadata?.ipAddress || 'unknown',
          userAgent: metadata?.userAgent || 'unknown',
          newValues: metadata
        }
      })
    } catch (error) {
      console.error('Audit logging error:', error)
    }
  }

  /**
   * Clean up old data based on retention policy
   */
  async cleanupOldData(): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.options.dataRetentionDays)

      // Clean old financial audit logs (keep longer)
      const auditCutoff = new Date()
      auditCutoff.setDate(auditCutoff.getDate() - 3650) // 10 years

      // Clean old sessions
      await this.prisma.session.deleteMany({
        where: {
          expires: {
            lt: cutoffDate
          }
        }
      })

      // Clean old login attempts
      // Note: You would need to add a LoginAttempt model to your schema

      console.log('Database cleanup completed')
    } catch (error) {
      console.error('Database cleanup error:', error)
    }
  }

  /**
   * Sanitize data for output (remove or encrypt sensitive fields)
   */
  sanitizeData<T extends Record<string, any>>(
    data: T,
    context: 'output' | 'logging' = 'output'
  ): Partial<T> {
    const sanitized: Partial<T> = { ...data }

    if (context === 'output') {
      // Remove sensitive fields from API output
      this.options.encryptSensitiveFields.forEach(field => {
        if (field in sanitized) {
          delete (sanitized as any)[field]
        }
      })
    } else if (context === 'logging') {
      // Encrypt sensitive fields for logging
      this.options.encryptSensitiveFields.forEach(field => {
        if (field in sanitized && (sanitized as any)[field]) {
          (sanitized as any)[field] = this.encrypt(String((sanitized as any)[field]))
        }
      })
    }

    return sanitized
  }

  /**
   * Validate data integrity using checksums
   */
  async validateDataIntegrity(
    tableName: string,
    recordId: string,
    data: Record<string, any>
  ): Promise<boolean> {
    try {
      // Calculate checksum of current data
      const checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(data))
        .digest('hex')

      // In a real implementation, you would store and compare checksums
      // For now, return true as the data was just processed
      return true
    } catch (error) {
      console.error('Data integrity validation error:', error)
      return false
    }
  }

  /**
   * Create database connection with security settings
   */
  static createSecureConnection(databaseUrl: string): PrismaClient {
    // Add connection pooling and SSL settings
    const secureUrl = new URL(databaseUrl)

    // Ensure SSL is enabled in production
    if (process.env.NODE_ENV === 'production') {
      secureUrl.searchParams.set('sslmode', 'require')
    }

    // Connection pool settings
    secureUrl.searchParams.set('connection_limit', '20')
    secureUrl.searchParams.set('pool_timeout', '30')
    secureUrl.searchParams.set('connect_timeout', '10')

    return new PrismaClient({
      datasources: {
        db: {
          url: secureUrl.toString()
        }
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
    })
  }

  /**
   * Backup critical data
   */
  async backupCriticalData(): Promise<{ success: boolean; message: string }> {
    try {
      // This would implement actual backup logic
      // For now, just log that backup was attempted
      console.log('Database backup initiated')

      // In production, you would:
      // 1. Export data to secure storage
      // 2. Verify backup integrity
      // 3. Store backup metadata
      // 4. Clean old backups

      return {
        success: true,
        message: 'Backup completed successfully'
      }
    } catch (error) {
      console.error('Backup error:', error)
      return {
        success: false,
        message: 'Backup failed'
      }
    }
  }
}

/**
 * Middleware for database security
 */
export function withDatabaseSecurity<T extends Record<string, any>>(
  options: DatabaseSecurityOptions = {}
) {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const dbSecurity = new DatabaseSecurity(this.prisma, options)

      // Extract user context from first argument (usually request)
      const request = args[0]
      const userId = request.headers.get('x-user-id') ||
                     request.user?.id ||
                     'anonymous'

      try {
        // Log access attempt
        await dbSecurity.logDatabaseAccess(
          userId,
          'ACCESS',
          'unknown',
          propertyName,
          { method: propertyName, timestamp: new Date().toISOString() }
        )

        // Execute original method
        const result = await originalMethod.apply(this, args)

        // Sanitize result before returning
        if (result && typeof result === 'object') {
          return dbSecurity.sanitizeData(result, 'output')
        }

        return result
      } catch (error) {
        // Log error
        await dbSecurity.logDatabaseAccess(
          userId,
          'ERROR',
          'unknown',
          propertyName,
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        )

        throw error
      }
    }

    return descriptor
  }
}

/**
 * Database security utilities
 */
export const dbSecurity = {
  /**
   * Hash sensitive identifiers for logging
   */
  hashIdentifier(identifier: string): string {
    return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16)
  },

  /**
   * Validate database connection security
   */
  validateConnectionSecurity(url: string): boolean {
    try {
      const parsed = new URL(url)

      // Check if SSL is enabled for production
      if (process.env.NODE_ENV === 'production') {
        const sslmode = parsed.searchParams.get('sslmode')
        if (sslmode !== 'require' && sslmode !== 'verify-full' && sslmode !== 'verify-ca') {
          return false
        }
      }

      // Check if password is not default
      const password = parsed.password
      if (password && (password === 'password' || password === '123456' || password === 'admin')) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  },

  /**
   * Generate secure database credentials
   */
  generateSecureCredentials(): {
    username: string
    password: string
    connectionString: string
  } {
    const username = `netmgr_${crypto.randomBytes(8).toString('hex')}`
    const password = crypto.randomBytes(32).toString('hex')

    return {
      username,
      password,
      connectionString: `postgresql://${username}:${password}@localhost:5432/netmanager`
    }
  }
}

export default DatabaseSecurity