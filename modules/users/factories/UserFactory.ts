/**
 * UserFactory
 *
 * Factory pattern for creating User with different configurations.
 * Handles default values for different user types.
 */

import type { WorkingHourMode } from '@prisma/client'
import type { CreateUserInput } from '../services/UserService'
import { prisma } from '@/lib/prisma'

export class UserFactory {
    /**
     * Create input for standard employee
     */
    static createEmployee(dto: {
        email: string
        name: string
        password: string
        phone?: string
        departmentId: string
        siteId?: string
        roleId?: string
    }): CreateUserInput {
        return {
            email: dto.email,
            name: dto.name,
            password: dto.password,
            phone: dto.phone,
            departmentId: dto.departmentId,
            siteId: dto.siteId,
            roleId: dto.roleId,
            isActive: true,
            isSales: false,
            // Default working hours (Fixed 9-5)
            workingHourMode: 'FIXED' as WorkingHourMode,
            startWorkTime: '09:00',
            endWorkTime: '17:00',
            workDays: 'Mon,Tue,Wed,Thu,Fri',
        }
    }

    /**
     * Create input for technician (field worker)
     */
    static createTechnician(dto: {
        email: string
        name: string
        password: string
        phone: string
        departmentId: string
        siteId?: string
        shiftId?: string
    }): CreateUserInput {
        return {
            email: dto.email,
            name: dto.name,
            password: dto.password,
            phone: dto.phone,
            departmentId: dto.departmentId,
            siteId: dto.siteId,
            isActive: true,
            isSales: false,
            // Flexible hours for field workers
            workingHourMode: 'FLEXIBLE' as WorkingHourMode,
            flexibleTargetHour: 8,
            workDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
            shiftId: dto.shiftId,
        }
    }

    /**
     * Create input for sales person
     */
    static createSales(dto: {
        email: string
        name: string
        password: string
        phone: string
        departmentId?: string
        siteId?: string
    }): CreateUserInput {
        return {
            email: dto.email,
            name: dto.name,
            password: dto.password,
            phone: dto.phone,
            departmentId: dto.departmentId,
            siteId: dto.siteId,
            isActive: true,
            isSales: true,
            // Flexible hours for sales
            workingHourMode: 'FLEXIBLE' as WorkingHourMode,
            flexibleTargetHour: 8,
            workDays: 'Mon,Tue,Wed,Thu,Fri,Sat',
        }
    }

    /**
     * Create input for admin user
     */
    static async createAdmin(dto: {
        email: string
        name: string
        password: string
        phone?: string
        siteId?: string
    }): Promise<CreateUserInput> {
        // Find admin role
        const adminRole = await prisma.role.findFirst({
            where: {
                OR: [
                    { name: { contains: 'Admin', mode: 'insensitive' } },
                    { name: 'SUPER_ADMIN' }
                ]
            },
            select: { id: true }
        })

        return {
            email: dto.email,
            name: dto.name,
            password: dto.password,
            phone: dto.phone,
            siteId: dto.siteId,
            roleId: adminRole?.id,
            isActive: true,
            isSales: false,
            workingHourMode: 'FIXED' as WorkingHourMode,
            startWorkTime: '09:00',
            endWorkTime: '17:00',
            workDays: 'Mon,Tue,Wed,Thu,Fri',
        }
    }

    /**
     * Create input for shift-based employee
     */
    static createShiftEmployee(dto: {
        email: string
        name: string
        password: string
        phone?: string
        departmentId: string
        siteId?: string
        shiftId: string
    }): CreateUserInput {
        return {
            email: dto.email,
            name: dto.name,
            password: dto.password,
            phone: dto.phone,
            departmentId: dto.departmentId,
            siteId: dto.siteId,
            isActive: true,
            isSales: false,
            workingHourMode: 'SHIFT' as WorkingHourMode,
            shiftId: dto.shiftId,
        }
    }

    /**
     * Generate a secure temporary password
     */
    static generateTempPassword(length: number = 12): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
        let password = ''
        for (let i = 0; i < length; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return password
    }

    /**
     * Validate email format
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        return emailRegex.test(email)
    }

    /**
     * Validate phone format (Indonesian)
     */
    static isValidPhone(phone: string): boolean {
        // Accept formats: 08xx, +628xx, 628xx
        const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{7,10}$/
        return phoneRegex.test(phone.replace(/[\s-]/g, ''))
    }
}
