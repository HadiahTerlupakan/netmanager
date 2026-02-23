import { UserRepository } from '../repositories/UserRepository'
import type { UserWithRelations } from '../repositories/UserRepository'
import { WorkingHourMode, Prisma } from '@prisma/client'
import type { User } from '@prisma/client'
import { hash } from 'bcryptjs'
import { cache } from '@/lib/cache'
import { invalidatePermissionCache } from '@/lib/auth'

export interface CreateUserInput {
    email: string
    name?: string
    password: string
    phone?: string
    departmentId?: string
    siteId?: string
    roleId?: string
    isActive?: boolean
    // Working Hours Settings
    workingHourMode?: string
    startWorkTime?: string
    endWorkTime?: string
    workDays?: string
    flexibleTargetHour?: number
    shiftId?: string | null
    // Sales Feature
    isSales?: boolean
}

export interface UpdateUserInput {
    email?: string
    name?: string
    phone?: string
    departmentId?: string | null
    siteId?: string | null
    roleId?: string | null
    isActive?: boolean
}

export class UserService {
    private userRepository: UserRepository

    constructor() {
        this.userRepository = new UserRepository()
    }

    async getAllUsers(siteId?: string): Promise<UserWithRelations[]> {
        return this.userRepository.findAll(siteId)
    }

    async getUser(id: string): Promise<User | null> {
        return this.userRepository.findById(id)
    }

    async getUserWithRelations(id: string): Promise<UserWithRelations | null> {
        return this.userRepository.findByIdWithRelations(id)
    }

    async getUserByEmail(email: string): Promise<User | null> {
        return this.userRepository.findByEmail(email)
    }

    async createUser(data: CreateUserInput): Promise<User> {
        // Check if email already exists
        const existingUser = await this.userRepository.findByEmail(data.email)
        if (existingUser) {
            throw new Error('Email sudah terdaftar')
        }

        // Hash password
        const passwordHash = await hash(data.password, 10)

        // Create user with working hours settings
        return this.userRepository.create({
            email: data.email,
            name: data.name || null,
            passwordHash,
            phone: data.phone || null,
            departmentId: data.departmentId || null,
            siteId: data.siteId || null,
            roleId: data.roleId || null,
            isActive: data.isActive,
            // Working Hours Settings
            workingHourMode: (data.workingHourMode as WorkingHourMode) || WorkingHourMode.FIXED,
            startWorkTime: data.startWorkTime || '09:00',
            endWorkTime: data.endWorkTime || '17:00',
            workDays: data.workDays || 'Mon,Tue,Wed,Thu,Fri',
            flexibleTargetHour: data.flexibleTargetHour || 8,
            shiftId: data.shiftId || null,
            // Sales Feature
            isSales: data.isSales || false,
        })
    }

    async updateUser(id: string, data: UpdateUserInput): Promise<User> {
        // Check if user exists
        const existingUser = await this.userRepository.findById(id)
        if (!existingUser) {
            throw new Error('User tidak ditemukan')
        }

        // If email is being changed, check if new email is available
        if (data.email && data.email !== existingUser.email) {
            const emailExists = await this.userRepository.findByEmail(data.email)
            if (emailExists) {
                throw new Error('Email sudah terdaftar')
            }
        }

        const updateData: Prisma.UserUpdateInput = {}
        if (data.email !== undefined) updateData.email = data.email
        if (data.name !== undefined) updateData.name = data.name
        if (data.phone !== undefined) updateData.phone = data.phone
        if (data.isActive !== undefined) updateData.isActive = data.isActive

        // Handle nullable foreign keys
        if (data.departmentId !== undefined) {
            updateData.departments = data.departmentId
                ? { connect: { id: data.departmentId } }
                : { disconnect: true }
        }
        if (data.siteId !== undefined) {
            updateData.sites = data.siteId
                ? { connect: { id: data.siteId } }
                : { disconnect: true }
        }
        if (data.roleId !== undefined) {
            updateData.role = data.roleId
                ? { connect: { id: data.roleId } }
                : { disconnect: true }
        }

        const updatedUser = await this.userRepository.update(id, updateData)

        // Invalidate attendance schedule cache
        cache.invalidate(`user:schedule:${id}`)

        // Invalidate permission cache when role changes
        if (data.roleId !== undefined) {
            await invalidatePermissionCache(id)
            // console.log(`[UserService] Permission cache invalidated for user: ${id}`)
        }

        return updatedUser
    }

    async deleteUser(id: string): Promise<User> {
        // Check if user exists
        const existingUser = await this.userRepository.findById(id)
        if (!existingUser) {
            throw new Error('User tidak ditemukan')
        }

        return this.userRepository.delete(id)
    }

    async updateWorkingHours(id: string, data: {
        workingHourMode: WorkingHourMode
        startWorkTime?: string | null
        endWorkTime?: string | null
        workDays?: string | null
        flexibleTargetHour?: number | null
        shiftId?: string | null
    }): Promise<User> {
        // Validation logic
        if (data.workingHourMode === WorkingHourMode.FIXED) {
            if (!data.startWorkTime || !data.endWorkTime) {
                throw new Error('Waktu mulai dan waktu selesai diperlukan untuk mode Fixed')
            }
            if (!data.workDays) {
                throw new Error('Hari kerja diperlukan untuk mode Fixed')
            }
        }

        if (data.workingHourMode === WorkingHourMode.FLEXIBLE) {
            // Optional: Add specific validation for Flexible mode if needed
        }

        const updatedUser = await this.userRepository.updateWorkingHours(id, data)
        
        // Invalidate attendance schedule cache to ensure immediate effect
        cache.invalidate(`user:schedule:${id}`)
        
        return updatedUser
    }
}

// Singleton instance
let userServiceInstance: UserService | null = null

export function getUserService(): UserService {
    if (!userServiceInstance) {
        userServiceInstance = new UserService()
    }
    return userServiceInstance
}

