import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { RoleService } from '@/modules/roles/services/RoleService'

// Mock RoleRepository
vi.mock('@/modules/roles/repositories/RoleRepository', () => ({
  RoleRepository: class MockRoleRepository {
    findAll = vi.fn().mockImplementation(() => prismaMock.role.findMany())
    findById = vi.fn().mockImplementation((id: string) => 
      prismaMock.role.findUnique({ where: { id } })
    )
    findByName = vi.fn().mockImplementation((name: string) => 
      prismaMock.role.findFirst({ where: { name } })
    )
    findByIdWithPermissions = vi.fn().mockImplementation((id: string) => 
      prismaMock.role.findUnique({ where: { id } })
    )
    create = vi.fn().mockImplementation((data: any) => 
      prismaMock.role.create({ data })
    )
    update = vi.fn().mockImplementation((id: string, data: any) => 
      prismaMock.role.update({ where: { id }, data })
    )
    delete = vi.fn().mockImplementation((id: string) => 
      prismaMock.role.delete({ where: { id } })
    )
    countUsers = vi.fn().mockImplementation((roleId: string) => 
      prismaMock.user.count({ where: { roleId } })
    )
  }
}))

describe('RoleService', () => {
  let service: RoleService

  beforeEach(() => {
    service = new RoleService()
  })

  describe('createRole', () => {
    it('should reject duplicate role name', async () => {
      // Mock: Role name already exists
      prismaMock.role.findFirst.mockResolvedValueOnce({
        id: 'existing-role',
        name: 'Manager'
      } as any)

      await expect(service.createRole({
        name: 'Manager',
        permissions: []
      }))
        .rejects.toThrow('Role with this name already exists')
    })

    it('should parse permissions and find existing permission IDs', async () => {
      // Mock: Role name not exists
      prismaMock.role.findFirst.mockResolvedValueOnce(null)
      
      // Mock: Find existing permissions
      prismaMock.permission.findMany.mockResolvedValueOnce([
        { id: 'perm-1', resource: 'users', action: 'read' },
        { id: 'perm-2', resource: 'users', action: 'write' }
      ] as any)

      // Mock: Create role
      prismaMock.role.create.mockResolvedValueOnce({
        id: 'new-role',
        name: 'Custom Role'
      } as any)

      const result = await service.createRole({
        name: 'Custom Role',
        permissions: ['users:read', 'users:write']
      })

      expect(result).toBeDefined()
      expect(prismaMock.permission.findMany).toHaveBeenCalled()
    })

    it('should deduplicate permissions', async () => {
      prismaMock.role.findFirst.mockResolvedValueOnce(null)
      prismaMock.permission.findMany.mockResolvedValueOnce([
        { id: 'perm-1', resource: 'users', action: 'read' }
      ] as any)
      prismaMock.role.create.mockResolvedValueOnce({
        id: 'new-role',
        name: 'Test Role'
      } as any)

      await service.createRole({
        name: 'Test Role',
        permissions: ['users:read', 'users:read', 'users:read'] // Duplicates
      })

      // Should only query for unique permissions
      expect(prismaMock.permission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ resource: 'users', action: 'read' }]
          })
        })
      )
    })
  })

  describe('updateRole', () => {
    it('should throw error if role not found', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce(null)

      await expect(service.updateRole('non-existent', {
        name: 'New Name',
        permissions: []
      }))
        .rejects.toThrow('Role not found')
    })

    it('should not allow renaming SUPER_ADMIN role', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'super-admin-id',
        name: 'SUPER_ADMIN'
      } as any)

      await expect(service.updateRole('super-admin-id', {
        name: 'Admin', // Trying to rename
        permissions: []
      }))
        .rejects.toThrow('Cannot rename SUPER_ADMIN role')
    })

    it('should allow updating SUPER_ADMIN without renaming', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'super-admin-id',
        name: 'SUPER_ADMIN'
      } as any)
      prismaMock.permission.findMany.mockResolvedValueOnce([])
      prismaMock.role.update.mockResolvedValueOnce({
        id: 'super-admin-id',
        name: 'SUPER_ADMIN',
        description: 'Updated description'
      } as any)

      const result = await service.updateRole('super-admin-id', {
        name: 'SUPER_ADMIN', // Same name
        description: 'Updated description',
        permissions: []
      })

      expect(result.name).toBe('SUPER_ADMIN')
    })
  })

  describe('deleteRole', () => {
    it('should throw error if role not found', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce(null)

      await expect(service.deleteRole('non-existent'))
        .rejects.toThrow('Role not found')
    })

    it('should not allow deleting SUPER_ADMIN role', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'super-admin-id',
        name: 'SUPER_ADMIN'
      } as any)

      await expect(service.deleteRole('super-admin-id'))
        .rejects.toThrow('Cannot delete SUPER_ADMIN role')
    })

    it('should not allow deleting role with assigned users', async () => {
      prismaMock.role.findUnique.mockResolvedValueOnce({
        id: 'role-1',
        name: 'Manager'
      } as any)
      // Mock: Role has users
      prismaMock.user.count.mockResolvedValueOnce(5)

      await expect(service.deleteRole('role-1'))
        .rejects.toThrow('Cannot delete role that has assigned users')
    })

    it('should delete role with no users', async () => {
      const mockRole = { id: 'role-1', name: 'Empty Role' }
      prismaMock.role.findUnique.mockResolvedValueOnce(mockRole as any)
      prismaMock.user.count.mockResolvedValueOnce(0) // No users
      prismaMock.role.delete.mockResolvedValueOnce(mockRole as any)

      const result = await service.deleteRole('role-1')

      expect(result.name).toBe('Empty Role')
    })
  })
})
