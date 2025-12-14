/**
 * Simple Departments API
 * Provides department list for user creation form
 * Non-HRIS departments that may be used for work orders
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/route-protection'
import { PrismaClient } from '@prisma/client'
import { unstable_cache } from 'next/cache'

const prisma = new PrismaClient()

// Cache departments for 5 minutes since they rarely change
const getCachedDepartments = unstable_cache(
  async () => {
    return await prisma.department.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })
  },
  ['departments'],
  {
    revalidate: 300, // 5 minutes
    tags: ['departments']
  }
)

export async function GET(request: NextRequest) {
  // Check authentication
  const authError = await requireAuth(request)
  if (authError) return authError

  try {
    const departments = await getCachedDepartments()

    return NextResponse.json({
      success: true,
      departments
    })
  } catch (error) {
    console.error('Error fetching departments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch departments' },
      { status: 500 }
    )
  }
}