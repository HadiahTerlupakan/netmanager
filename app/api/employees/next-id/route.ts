/**
 * Generate Next Employee ID
 * Simple employee ID generation for user creation
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/route-protection'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Cache next ID for 1 minute to avoid excessive DB calls during rapid form interactions
let cachedNextId: { id: string; timestamp: number } | null = null

function getNextEmployeeId(lastId: string | null): string {
  const nextId = 'EMP001'

  if (lastId) {
    const match = lastId.match(/\d+$/)
    if (match) {
      const num = parseInt(match[0]) + 1
      const prefix = lastId.replace(/\d+$/, '')
      return `${prefix}${num.toString().padStart(3, '0')}`
    }
  }

  return nextId
}

export async function GET(request: NextRequest) {
  // Check authentication
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    // Check cache first (valid for 1 minute)
    const now = Date.now()
    if (cachedNextId && (now - cachedNextId.timestamp) < 60000) {
      return NextResponse.json({
        success: true,
        nextId: cachedNextId.id
      })
    }

    // Get the latest employee ID
    const lastEmployee = await prisma.employee.findFirst({
      select: {
        employeeId: true
      },
      orderBy: {
        employeeId: 'desc'
      }
    })

    const nextId = getNextEmployeeId(lastEmployee?.employeeId || null)

    // Cache the result
    cachedNextId = {
      id: nextId,
      timestamp: now
    }

    return NextResponse.json({
      success: true,
      nextId
    })
  } catch (error) {
    console.error('Error generating employee ID:', error)
    return NextResponse.json(
      { error: 'Failed to generate employee ID' },
      { status: 500 }
    )
  }
}