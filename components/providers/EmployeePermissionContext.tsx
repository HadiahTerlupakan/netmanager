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
    role: string | null
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
        // ADMIN users have all features
        if (session?.user?.role === 'ADMIN') {
            return true
        }

        if (!permissions) {
            return false
        }

        return permissions.allowedFeatures.includes(feature)
    }

    const isAdmin = (): boolean => {
        return session?.user?.role === 'ADMIN'
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
