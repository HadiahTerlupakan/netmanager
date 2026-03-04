import { describe, it, expect, beforeEach, vi } from 'vitest'
import { prismaMock } from '../../setup'
import { UserService, type CreateUserInput } from '@/modules/users/services/UserService'
import { WorkingHourMode, type User } from '@prisma/client'

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed_password')
}))

// Mock UserRepository to use prismaMock
vi.mock('@/modules/users/repositories/UserRepository', () => ({
  UserRepository: class MockUserRepository {
    findAll = vi.fn().mockImplementation(() => prismaMock.user.findMany())
    findById = vi.fn().mockImplementation((id: string) =>
      prismaMock.user.findUnique({ where: { id } })
    )
    findByEmail = vi.fn().mockImplementation((email: string) =>
      prismaMock.user.findFirst({ where: { email } })
    )
    findByIdWithRelations = vi.fn().mockImplementation((id: string) =>
      prismaMock.user.findUnique({ where: { id } })
    )
    create = vi.fn().mockImplementation((data: unknown) =>
      prismaMock.user.create({ data: data as unknown as User })
    )
    update = vi.fn().mockImplementation((id: string, data: unknown) =>
      prismaMock.user.update({ where: { id }, data: data as unknown as User })
    )
    delete = vi.fn().mockImplementation((id: string) =>
      prismaMock.user.delete({ where: { id } })
    )
    updateWorkingHours = vi.fn().mockImplementation((id: string, data: unknown) =>
      prismaMock.user.update({ where: { id }, data: data as unknown as User })
    )
  }
}))

describe('UserService', () => {
  let service: UserService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new UserService()
  })

  describe('createUser', () => {
    const validInput: CreateUserInput = {
      email: 'newuser@example.com',
      name: 'New User',
      password: 'password123',
      isActive: true
    }

    it('should reject duplicate email', async () => {
      // Mock: Email sudah terdaftar
      prismaMock.user.findFirst.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'newuser@example.com'
      } as unknown as User)

      await expect(service.createUser(validInput))
        .rejects.toThrow('Email sudah terdaftar')
    })

    it('should hash password before creating user', async () => {
      const { hash } = await import('bcryptjs')

      // Mock: Email not exists
      prismaMock.user.findFirst.mockResolvedValueOnce(null)
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'newuser@example.com',
        passwordHash: 'hashed_password'
      } as unknown as User)

      await service.createUser(validInput)

      expect(hash).toHaveBeenCalledWith('password123', 10)
    })

    it('should create user successfully with valid input', async () => {
      prismaMock.user.findFirst.mockResolvedValueOnce(null)
      prismaMock.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'newuser@example.com',
        name: 'New User'
      } as unknown as User)

      const result = await service.createUser(validInput)

      expect(result).toBeDefined()
      expect(result.email).toBe('newuser@example.com')
    })
  })

  describe('updateUser', () => {
    it('should throw error if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null)

      await expect(service.updateUser('non-existent', { name: 'New Name' }))
        .rejects.toThrow('User tidak ditemukan')
    })

    it('should reject duplicate email when updating', async () => {
      // Mock: User exists
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'original@example.com'
      } as unknown as User)

      // Mock: New email already taken by another user
      prismaMock.user.findFirst.mockResolvedValueOnce({
        id: 'another-user',
        email: 'taken@example.com'
      } as unknown as User)

      await expect(service.updateUser('user-1', { email: 'taken@example.com' }))
        .rejects.toThrow('Email sudah terdaftar')
    })

    it('should allow same email when not changing it', async () => {
      const existingUser = {
        id: 'user-1',
        email: 'same@example.com',
        name: 'User'
      }

      prismaMock.user.findUnique.mockResolvedValueOnce(existingUser as unknown as User)
      prismaMock.user.update.mockResolvedValueOnce({
        ...existingUser,
        name: 'New Name'
      } as unknown as User)

      // Update name only, keeping same email
      const result = await service.updateUser('user-1', {
        email: 'same@example.com',
        name: 'New Name'
      })

      expect(result.name).toBe('New Name')
    })
  })

  describe('deleteUser', () => {
    it('should throw error if user not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null)

      await expect(service.deleteUser('non-existent'))
        .rejects.toThrow('User tidak ditemukan')
    })

    it('should delete user successfully', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com' }
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUser as unknown as User)
      prismaMock.user.delete.mockResolvedValueOnce(mockUser as unknown as User)

      const result = await service.deleteUser('user-1')

      expect(result.id).toBe('user-1')
    })
  })

  describe('updateWorkingHours', () => {
    it('should require start and end time for FIXED mode', async () => {
      await expect(service.updateWorkingHours('user-1', {
        workingHourMode: WorkingHourMode.FIXED,
        // Missing startWorkTime and endWorkTime
      }))
        .rejects.toThrow('Waktu mulai dan waktu selesai diperlukan untuk mode Fixed')
    })

    it('should require work days for FIXED mode', async () => {
      await expect(service.updateWorkingHours('user-1', {
        workingHourMode: WorkingHourMode.FIXED,
        startWorkTime: '08:00',
        endWorkTime: '17:00'
        // Missing workDays
      }))
        .rejects.toThrow('Hari kerja diperlukan untuk mode Fixed')
    })

    it('should update working hours successfully', async () => {
      prismaMock.user.update.mockResolvedValueOnce({
        id: 'user-1',
        workingHourMode: WorkingHourMode.FIXED,
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workDays: 'MON,TUE,WED,THU,FRI'
      } as unknown as User)

      const result = await service.updateWorkingHours('user-1', {
        workingHourMode: WorkingHourMode.FIXED,
        startWorkTime: '08:00',
        endWorkTime: '17:00',
        workDays: 'MON,TUE,WED,THU,FRI'
      })

      expect(result.workingHourMode).toBe(WorkingHourMode.FIXED)
    })
  })
})
