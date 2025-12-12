'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useSession } from 'next-auth/react'

interface EmployeeData {
    id: string
    employeeId: string
    fullName: string
    email: string | null
    phone: string | null
    photoUrl: string | null
    departmentId: string | null
    departmentName: string | null
    positionId: string | null
    positionTitle: string | null
    employmentStatus: string
    joinDate: string
    isActive: boolean
}

interface EmployeePermissions {
    employeeId: string
    departmentId: string | null
    departmentName: string | null
    allowedFeatures: string[]
    customRoles?: Array<{
        id: string
        name: string
        code: string
    }>
}

interface EmployeePermissionContextType {
    employee: EmployeeData | null
    permissions: EmployeePermissions | null
    loading: boolean
    error: string | null
    hasFeature: (feature: string) => boolean
    isAdmin: () => boolean
    refetch: () => Promise<void>
}

const EmployeePermissionContext = createContext<EmployeePermissionContextType | undefined>(
    undefined
)

export function EmployeePermissionProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession()
    const [employee, setEmployee] = useState<EmployeeData | null>(null)
    const [permissions, setPermissions] = useState<EmployeePermissions | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchEmployeeData = async () => {
        if (status === 'loading') return

        if (!session?.user) {
            setLoading(false)
            return
        }

        try {
            setLoading(true)
            setError(null)

            const response = await fetch('/api/employee/me')

            if (!response.ok) {
                if (response.status === 404) {
                    // Employee profile not found - this is ok for non-employee users
                    setEmployee(null)
                    setPermissions(null)
                    setLoading(false)
                    return
                }
                throw new Error('Failed to fetch employee data')
            }

            const data = await response.json()
            console.log('[EMPLOYEE-CONTEXT] Received data:', {
                hasEmployee: !!data.employee,
                hasPermissions: !!data.permissions,
                allowedFeaturesCount: data.permissions?.allowedFeatures?.length || 0,
                allowedFeatures: data.permissions?.allowedFeatures || [],
                customRoles: data.permissions?.customRoles?.map((r: any) => r.name) || [],
            })
            setEmployee(data.employee)
            setPermissions(data.permissions)
        } catch (err: any) {
            console.error('Error fetching employee data:', err)
            setError(err.message || 'Failed to load employee data')
            setEmployee(null)
            setPermissions(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEmployeeData()
    }, [session, status])

    const hasFeature = (feature: string): boolean => {
        if (!permissions) {
            return false
        }

        // 1. Exact match
        if (permissions.allowedFeatures.includes(feature)) {
            return true
        }

        // 2. Parent match - if user has 'HRIS', they also have 'HRIS.EMPLOYEES'
        const parts = feature.split('.')
        while (parts.length > 1) {
            parts.pop()
            const parent = parts.join('.')
            if (permissions.allowedFeatures.includes(parent)) {
                return true
            }
        }

        // 3. Suffix/Base match - if menu needs 'EMPLOYEE.INVENTORY' and user has 'INVENTORY'
        // This handles the case where admin portal uses 'INVENTORY' but employee portal uses 'EMPLOYEE.INVENTORY'
        const baseParts = feature.split('.')
        if (baseParts.length > 1) {
            const lastPart = baseParts[baseParts.length - 1] // e.g. 'INVENTORY'
            if (permissions.allowedFeatures.includes(lastPart)) {
                return true
            }
        }

        return false
    }

    const isAdmin = (): boolean => {
        // Check if user has administrative permissions
        if (!permissions) {
            return false
        }

        // Consider user as admin if they have high-level permissions
        return permissions.allowedFeatures.includes('USERS') ||
            permissions.allowedFeatures.includes('SETTINGS') ||
            permissions.allowedFeatures.includes('ROLES')
    }

    const refetch = async () => {
        await fetchEmployeeData()
    }

    const value: EmployeePermissionContextType = {
        employee,
        permissions,
        loading,
        error,
        hasFeature,
        isAdmin,
        refetch,
    }

    return (
        <EmployeePermissionContext.Provider value={value}>
            {children}
        </EmployeePermissionContext.Provider>
    )
}

export function useEmployeePermissions() {
    const context = useContext(EmployeePermissionContext)
    if (context === undefined) {
        throw new Error('useEmployeePermissions must be used within EmployeePermissionProvider')
    }
    return context
}
