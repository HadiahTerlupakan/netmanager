import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  parsePermissionMatrix,
  serializePermissionMatrix,
  convertLegacyToMatrix
} from '@/lib/utils/permissions'
import type { PermissionMatrix } from '@/lib/types/permissions'

// GET /api/roles - List all active roles
export async function GET(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const whereCondition = includeInactive
      ? {}
      : { isActive: true }

    const roles = await prisma.customRole.findMany({
      where: whereCondition,
      include: {
        _count: {
          select: {
            employeeRoles: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    const formattedRoles = roles.map(role => {
      // Parse permissions - handle both legacy array and new matrix format
      const matrix = parsePermissionMatrix(role.allowedFeatures)
      const legacyPermissions = Object.keys(matrix)

      return {
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description,
        permissions: legacyPermissions,  // Legacy format for backward compatibility
        permissionMatrix: matrix,  // New format
        allowedFeatures: role.allowedFeatures,  // Raw JSON string
        priority: role.priority,
        isActive: role.isActive,
        assignedUsers: role._count.employeeRoles
      }
    })

    return NextResponse.json({ roles: formattedRoles })
  } catch (error: any) {
    console.error('Error fetching roles:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/roles - Create new role
export async function POST(req: NextRequest) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, permissions, permissionMatrix } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Determine features to store
    let featuresToStore: string
    if (permissionMatrix && typeof permissionMatrix === 'object') {
      // New format - use permission matrix directly
      featuresToStore = serializePermissionMatrix(permissionMatrix)
    } else if (permissions && Array.isArray(permissions)) {
      // Legacy format - convert to matrix
      featuresToStore = serializePermissionMatrix(convertLegacyToMatrix(permissions))
    } else {
      return NextResponse.json({ error: 'Permissions are required' }, { status: 400 })
    }

    // Generate unique code
    const baseCode = name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase()
    const code = `${baseCode}_${suffix}`

    // Check if role name already exists
    const existingRole = await prisma.customRole.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' }
      }
    })

    if (existingRole) {
      return NextResponse.json({ error: 'Role with this name already exists' }, { status: 409 })
    }

    // Create role without department (global role)
    const role = await prisma.customRole.create({
      data: {
        name,
        code,
        description,
        allowedFeatures: featuresToStore,
        priority: 0, // Priority removed
        isActive: true
      }
    })

    // Parse back for response
    const savedMatrix = parsePermissionMatrix(role.allowedFeatures)

    return NextResponse.json({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: Object.keys(savedMatrix),
      permissionMatrix: savedMatrix,
      priority: 0, // Priority removed
      isActive: role.isActive,
      assignedUsers: 0
    }, { status: 201 })

  } catch (error: any) {
    console.error('Error creating role:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}