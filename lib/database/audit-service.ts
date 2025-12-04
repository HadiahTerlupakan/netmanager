import { PrismaClient } from '@prisma/client'
import DatabaseSecurity from './security'

export interface AuditEvent {
  userId: string
  action: string
  entityType: string
  entityId?: string
  description: string
  ipAddress?: string
  userAgent?: string
  oldValue?: any
  newValue?: any
  metadata?: Record<string, any>
}

export interface QueryAuditEvent {
  userId: string
  query: string
  parameters?: any[]
  table?: string
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  executionTime: number
  recordCount?: number
  ipAddress?: string
  userAgent?: string
}

/**
 * Database Audit Service
 */
export class DatabaseAuditService {
  private prisma: PrismaClient
  private security: DatabaseSecurity

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
    this.security = new DatabaseSecurity(prisma, {
      enableAuditLogging: true,
      enableDataEncryption: true
    })
  }

  /**
   * Log database operation for audit
   */
  async logOperation(event: AuditEvent): Promise<void> {
    try {
      // Sanitize sensitive data
      const sanitizedOldValue = event.oldValue
        ? this.security.sanitizeData(event.oldValue, 'logging')
        : undefined

      const sanitizedNewValue = event.newValue
        ? this.security.sanitizeData(event.newValue, 'logging')
        : undefined

      await this.prisma.financialAuditLog.create({
        data: {
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          description: event.description,
          userId: event.userId,
          ipAddress: event.ipAddress || 'unknown',
          userAgent: event.userAgent || 'unknown',
          oldValues: sanitizedOldValue,
          newValues: {
            ...sanitizedNewValue,
            metadata: event.metadata,
            timestamp: new Date().toISOString()
          }
        }
      })
    } catch (error) {
      console.error('Failed to log audit event:', error)
    }
  }

  /**
   * Log query for performance monitoring
   */
  async logQuery(event: QueryAuditEvent): Promise<void> {
    try {
      // In production, you might store this in a separate query audit table
      // For now, log to console with sensitive data masked
      const maskedQuery = this.maskSensitiveData(event.query)

      console.log('Query Audit:', {
        userId: this.security.hashIdentifier(event.userId),
        query: maskedQuery,
        operation: event.operation,
        executionTime: event.executionTime,
        recordCount: event.recordCount,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to log query audit:', error)
    }
  }

  /**
   * Get audit trail for specific entity
   */
  async getAuditTrail(
    entityType: string,
    entityId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      return await this.prisma.financialAuditLog.findMany({
        where: {
          entityType,
          entityId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          action: true,
          description: true,
          userId: true,
          createdAt: true,
          newValues: true,
          oldValues: true
        }
      })
    } catch (error) {
      console.error('Failed to get audit trail:', error)
      return []
    }
  }

  /**
   * Get user activity audit
   */
  async getUserActivity(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      return await this.prisma.financialAuditLog.findMany({
        where: {
          userId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          createdAt: true,
          ipAddress: true
        }
      })
    } catch (error) {
      console.error('Failed to get user activity:', error)
      return []
    }
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(startDate: Date, endDate: Date): Promise<{
    summary: Record<string, number>
    topUsers: Array<{ userId: string; actionCount: number }>
    topEntities: Array<{ entityType: string; actionCount: number }>
    suspiciousActivities: Array<any>
  }> {
    try {
      // Get action summary
      const actionSummary = await this.prisma.financialAuditLog.groupBy({
        by: ['action'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        }
      })

      const summary: Record<string, number> = {}
      actionSummary.forEach(item => {
        summary[item.action] = item._count.id
      })

      // Get top active users
      const topUsers = await this.prisma.financialAuditLog.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      })

      // Get top accessed entities
      const topEntities = await this.prisma.financialAuditLog.groupBy({
        by: ['entityType'],
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        _count: {
          id: true
        },
        orderBy: {
          _count: {
            id: 'desc'
          }
        },
        take: 10
      })

      // Get suspicious activities (multiple DELETE operations, etc.)
      const suspiciousActivities = await this.prisma.financialAuditLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          },
          action: {
            contains: 'DELETE'
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 50,
        select: {
          userId: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          createdAt: true,
          ipAddress: true
        }
      })

      return {
        summary,
        topUsers: topUsers.map(item => ({
          userId: this.security.hashIdentifier(item.userId),
          actionCount: item._count.id
        })),
        topEntities: topEntities.map(item => ({
          entityType: item.entityType,
          actionCount: item._count.id
        })),
        suspiciousActivities
      }
    } catch (error) {
      console.error('Failed to generate audit report:', error)
      return {
        summary: {},
        topUsers: [],
        topEntities: [],
        suspiciousActivities: []
      }
    }
  }

  /**
   * Check for suspicious patterns
   */
  async checkSuspiciousPatterns(userId: string): Promise<{
    isSuspicious: boolean
    reasons: string[]
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }> {
    const reasons: string[] = []
    const now = new Date()
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
    const lastDay = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    try {
      // Check for excessive activity in last hour
      const hourlyActivity = await this.prisma.financialAuditLog.count({
        where: {
          userId,
          createdAt: {
            gte: lastHour
          }
        }
      })

      if (hourlyActivity > 100) {
        reasons.push('Excessive activity (100+ actions in last hour)')
      }

      // Check for multiple DELETE operations
      const deleteOperations = await this.prisma.financialAuditLog.count({
        where: {
          userId,
          action: {
            contains: 'DELETE'
          },
          createdAt: {
            gte: lastDay
          }
        }
      })

      if (deleteOperations > 10) {
        reasons.push('Multiple delete operations detected')
      }

      // Check for access from multiple IPs
      const uniqueIPs = await this.prisma.financialAuditLog.groupBy({
        by: ['ipAddress'],
        where: {
          userId,
          createdAt: {
            gte: lastDay
          },
          ipAddress: {
            not: 'unknown'
          }
        }
      })

      if (uniqueIPs.length > 5) {
        reasons.push('Access from multiple IP addresses')
      }

      // Check for failed login attempts
      const failedLogins = await this.prisma.financialAuditLog.count({
        where: {
          userId,
          action: 'LOGIN_FAILED',
          createdAt: {
            gte: lastDay
          }
        }
      })

      if (failedLogins > 5) {
        reasons.push('Multiple failed login attempts')
      }

      // Determine risk level
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW'
      if (reasons.length >= 3) {
        riskLevel = 'CRITICAL'
      } else if (reasons.length >= 2) {
        riskLevel = 'HIGH'
      } else if (reasons.length >= 1) {
        riskLevel = 'MEDIUM'
      }

      return {
        isSuspicious: reasons.length > 0,
        reasons,
        riskLevel
      }
    } catch (error) {
      console.error('Error checking suspicious patterns:', error)
      return {
        isSuspicious: false,
        reasons: [],
        riskLevel: 'LOW'
      }
    }
  }

  /**
   * Mask sensitive data in SQL queries
   */
  private maskSensitiveData(query: string): string {
    // Remove potential sensitive data from query logs
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password=***")
      .replace(/token\s*=\s*'[^']*'/gi, "token=***")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret=***")
      .replace(/api_key\s*=\s*'[^']*'/gi, "api_key=***")
      .replace(/nik\s*=\s*'[^']*'/gi, "nik=***")
      .replace(/email\s*=\s*'[^']*'/gi, "email=***")
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 2555): Promise<void> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      await this.prisma.financialAuditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      })

      console.log(`Cleaned up audit logs older than ${retentionDays} days`)
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error)
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.prisma.financialAuditLog.findMany({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: 'asc'
        },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          description: true,
          userId: true,
          ipAddress: true,
          createdAt: true,
          newValues: true,
          oldValues: true
        }
      })

      if (format === 'csv') {
        const headers = ['id', 'action', 'entityType', 'entityId', 'description', 'userId', 'ipAddress', 'createdAt']
        const csvRows = [
          headers.join(','),
          ...logs.map(log => [
            log.id,
            log.action,
            log.entityType,
            log.entityId || '',
            `"${log.description}"`,
            this.security.hashIdentifier(log.userId),
            log.ipAddress,
            log.createdAt.toISOString()
          ].join(','))
        ]

        return csvRows.join('\n')
      } else {
        return JSON.stringify(logs, null, 2)
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      throw new Error('Export failed')
    }
  }
}

export default DatabaseAuditService