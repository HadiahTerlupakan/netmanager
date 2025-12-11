import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  parsePermissionMatrix,
  serializePermissionMatrix,
  convertLegacyToMatrix
} from '@/lib/utils/permissions'

// GET /api/roles/[id] - Get specific role
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = await prisma.customRole.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeRoles: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Parse permissions - handle both legacy and new format
    const matrix = parsePermissionMatrix(role.allowedFeatures)

    return NextResponse.json({
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: Object.keys(matrix),  // Legacy format
      permissionMatrix: matrix,  // New format
      allowedFeatures: role.allowedFeatures,  // Raw JSON
      priority: role.priority,
      isActive: role.isActive,
      assignedUsers: role._count.employeeRoles
    })

  } catch (error: any) {
    console.error('Error fetching role:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/roles/[id] - Update role
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, permissions, permissionMatrix, priority, isActive } = body

    // Check if role exists
    const { id } = await params
    const existingRole = await prisma.customRole.findUnique({
      where: { id }
    })

    if (!existingRole) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Check for duplicate name (excluding current role)
    if (name) {
      const duplicateRole = await prisma.customRole.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            { name: { equals: name, mode: 'insensitive' } }
          ]
        }
      })

      if (duplicateRole) {
        return NextResponse.json({ error: 'Role with this name already exists' }, { status: 409 })
      }
    }

    const updateData: any = {}
    if (name) {
      updateData.name = name
      // Don't update code on name change to preserve existing references
    }
    if (description !== undefined) updateData.description = description

    // Handle permissions - prefer new matrix format
    if (permissionMatrix && typeof permissionMatrix === 'object') {
      updateData.allowedFeatures = serializePermissionMatrix(permissionMatrix)
    } else if (permissions && Array.isArray(permissions)) {
      updateData.allowedFeatures = serializePermissionMatrix(convertLegacyToMatrix(permissions))
    }

    // Priority removed
    // if (priority !== undefined) updateData.priority = priority
    if (isActive !== undefined) updateData.isActive = isActive

    const updatedRole = await prisma.customRole.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            employeeRoles: true
          }
        }
      }
    })

    // Parse for response
    const savedMatrix = parsePermissionMatrix(updatedRole.allowedFeatures)

    return NextResponse.json({
      id: updatedRole.id,
      name: updatedRole.name,
      code: updatedRole.code,
      description: updatedRole.description,
      permissions: JSON.parse(updatedRole.allowedFeatures || '[]'),
      permissionMatrix: savedMatrix,
      priority: 0, // Priority removed
      isActive: updatedRole.isActive,
      assignedUsers: updatedRole._count.employeeRoles
    })

  } catch (error: any) {
    console.error('Error updating role:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}


// DELETE /api/roles/[id] - Delete role
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session: any = await getServerSession(authConfig as any)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if role exists
    const { id } = await params
    const role = await prisma.customRole.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeRoles: true
          }
        }
      }
    })

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 404 })
    }

    // Check if role is assigned to users
    if (role._count.employeeRoles > 0) {
      return NextResponse.json({
        error: `Cannot delete role. It is assigned to ${role._count.employeeRoles} users.`
      }, { status: 400 })
    }

    await prisma.customRole.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Role deleted successfully' })

  } catch (error: any) {
    console.error('Error deleting role:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}