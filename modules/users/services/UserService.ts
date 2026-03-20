import { UserRepository } from '../repositories/UserRepository'
import type { UserWithRelations } from '../repositories/UserRepository'
import { WorkingHourMode, Prisma } from '@prisma/client'
import type { User } from '@prisma/client'
import { hash } from 'bcryptjs'
import { checkGlobalIdentifier } from '@/lib/validations/global-identifier'
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
    attendanceGeofencePolicy?: string
    startWorkTime?: string
    endWorkTime?: string
    workDays?: string
    flexibleTargetHour?: number
    shiftId?: string | null
    // Sales Feature
    isSales?: boolean
    tenantId?: string | null
}

type AttendanceGeofencePolicy = 'STRICT' | 'WARN' | 'DISABLED'

export interface UpdateUserInput {
    email?: string
    name?: string
    phone?: string
    departmentId?: string | null
    siteId?: string | null
    roleId?: string | null
    isActive?: boolean
    tenantId?: string | null
    // Working Hours
    workingHourMode?: string
    attendanceGeofencePolicy?: string
    startWorkTime?: string | null
    endWorkTime?: string | null
    workDays?: string | null
    flexibleTargetHour?: number | null
    shiftId?: string | null
    isSales?: boolean
}

export class UserService {
    private userRepository: UserRepository

    constructor() {
        this.userRepository = new UserRepository()
    }

    async getAllUsers(siteId?: string, tenantId?: string, roleName?: string): Promise<UserWithRelations[]> {
        return this.userRepository.findAll(siteId, tenantId, roleName)
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
        // Check if email already exists globally
        const globalCheck = await checkGlobalIdentifier(data.email)
        if (globalCheck.exists) {
            throw new Error(`Email sudah terdaftar sebagai ${globalCheck.role}`)
        }

        // Hash password
        const passwordHash = await hash(data.password, 10)

        // Create user with working hours settings
        const user = await this.userRepository.create({
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
            attendanceGeofencePolicy: (data.attendanceGeofencePolicy as AttendanceGeofencePolicy) || 'WARN',
            startWorkTime: data.startWorkTime || '09:00',
            endWorkTime: data.endWorkTime || '17:00',
            workDays: data.workDays || 'Mon,Tue,Wed,Thu,Fri',
            flexibleTargetHour: data.flexibleTargetHour || 8,
            shiftId: data.shiftId || null,
            // Sales Feature
            isSales: data.isSales || false,
            tenantId: data.tenantId || null,
        })

        // Invalidate permission cache for new user
        await invalidatePermissionCache(user.id)

        return user
    }

    async updateUser(id: string, data: UpdateUserInput): Promise<User> {
        // Check if user exists
        const existingUser = await this.userRepository.findById(id)
        if (!existingUser) {
            throw new Error('User tidak ditemukan')
        }

        // If email is being changed, check if new email is available globally
        if (data.email && data.email !== existingUser.email) {
            const globalCheck = await checkGlobalIdentifier(data.email, undefined, id)
            if (globalCheck.exists) {
                throw new Error(`Email sudah terdaftar sebagai ${globalCheck.role}`)
            }
        }

        const updateData: Prisma.UserUncheckedUpdateInput = {}
        if (data.email !== undefined) updateData.email = data.email
        if (data.name !== undefined) updateData.name = data.name
        if (data.phone !== undefined) updateData.phone = data.phone
        if (data.isActive !== undefined) updateData.isActive = data.isActive

        if (data.departmentId !== undefined) updateData.departmentId = data.departmentId || null
        if (data.siteId !== undefined) updateData.siteId = data.siteId || null
        
        // Working Hours
        if (data.workingHourMode !== undefined) updateData.workingHourMode = data.workingHourMode as WorkingHourMode
        if (data.attendanceGeofencePolicy !== undefined) updateData.attendanceGeofencePolicy = data.attendanceGeofencePolicy as AttendanceGeofencePolicy
        if (data.startWorkTime !== undefined) updateData.startWorkTime = data.startWorkTime
        if (data.endWorkTime !== undefined) updateData.endWorkTime = data.endWorkTime
        if (data.workDays !== undefined) updateData.workDays = data.workDays
        if (data.flexibleTargetHour !== undefined) updateData.flexibleTargetHour = data.flexibleTargetHour
        if (data.shiftId !== undefined) updateData.shiftId = data.shiftId || null

        if (data.isSales !== undefined) updateData.isSales = data.isSales

        if (data.roleId !== undefined) {
            updateData.roleId = data.roleId || null
        }
        if (data.tenantId !== undefined) {
            updateData.tenantId = data.tenantId || null
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
