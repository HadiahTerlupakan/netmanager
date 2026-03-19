import { randomUUID } from 'crypto'

import { NextRequest, NextResponse } from 'next/server'
import { LogType } from '@prisma/client'

import { logger } from '@/lib/logger'
import { authenticateMobileRequest } from '@/lib/mobile-api-auth'
import { prisma } from '@/lib/prisma'
import { validateRequired } from '@/lib/validation-utils'
import { apiError, ErrorCodes } from '@/lib/api-response'

type MobileErrorReportPayload = {
  message?: unknown
  kind?: unknown
  source?: unknown
  severity?: unknown
  route?: unknown
  screen?: unknown
  appVersion?: unknown
  platform?: unknown
  occurredAt?: unknown
  stack?: unknown
  breadcrumbs?: unknown
  context?: unknown
}

const sanitizeString = (value: unknown, maxLength = 1000): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.slice(0, maxLength)
}

const getClientIp = (request: NextRequest): string | null => {
  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) {
    return null
  }

  return forwarded.split(',')[0]?.trim() || null
}

const serializeDetails = (payload: Record<string, unknown>): string => {
  try {
    return JSON.stringify(payload)
  } catch {
    return JSON.stringify({
      message: 'Failed to serialize mobile error report payload',
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MobileErrorReportPayload

    const sanitizedMessage = sanitizeString(body.message, 1000)
    const sanitizedKind = sanitizeString(body.kind, 120)
    const sanitizedSource = sanitizeString(body.source, 120)

    const messageValidation = validateRequired(sanitizedMessage, 'message')
    if (!messageValidation.valid) {
      return NextResponse.json({ error: messageValidation.error }, { status: 400 })
    }

    const kindValidation = validateRequired(sanitizedKind, 'kind')
    if (!kindValidation.valid) {
      return NextResponse.json({ error: kindValidation.error }, { status: 400 })
    }

    const sourceValidation = validateRequired(sanitizedSource, 'source')
    if (!sourceValidation.valid) {
      return NextResponse.json({ error: sourceValidation.error }, { status: 400 })
    }

    let authPayload: { userId?: string; tenant?: string; role?: string; email?: string } | null = null
    const authHeader = request.headers.get('authorization')

    if (authHeader?.startsWith('Bearer ')) {
      const authResult = await authenticateMobileRequest(request)
      if ('payload' in authResult) {
        authPayload = authResult.payload
      } else {
        logger.warn('Mobile error report received with invalid auth, falling back to anonymous report', {
          status: authResult.response.status,
        })
      }
    }

    const reportDetails = {
      message: sanitizedMessage,
      kind: sanitizedKind,
      source: sanitizedSource,
      severity: sanitizeString(body.severity, 50) || 'error',
      route: sanitizeString(body.route, 255),
      screen: sanitizeString(body.screen, 255),
      appVersion: sanitizeString(body.appVersion, 120),
      platform: sanitizeString(body.platform, 50),
      occurredAt: sanitizeString(body.occurredAt, 100),
      stack: sanitizeString(body.stack, 8000),
      breadcrumbs: Array.isArray(body.breadcrumbs) ? body.breadcrumbs.slice(-20) : [],
      context: typeof body.context === 'object' && body.context !== null ? body.context : {},
      authContext: authPayload
        ? {
            tenant: authPayload.tenant ?? null,
            role: authPayload.role ?? null,
            email: authPayload.email ?? null,
          }
        : null,
    }

    logger.error('Mobile error report received', undefined, reportDetails)

    await prisma.systemLog.create({
      data: {
        id: randomUUID(),
        type: LogType.SYSTEM,
        action: 'MOBILE_ERROR_REPORT',
        subject: reportDetails.kind ?? 'unknown',
        details: serializeDetails(reportDetails),
        userId: authPayload?.userId ?? null,
        ipAddress: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Mobile error report route failed', error instanceof Error ? error : undefined, {
      route: '/api/mobile/error-report',
    })

    return apiError('Terjadi kesalahan server', ErrorCodes.INTERNAL_ERROR, { status: 500 })
  }
}
