'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface CustomerSession {
    id: string
    idPelanggan: string
    nama: string
    email: string | null
}

interface CustomerAuthContextType {
    customer: CustomerSession | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    refresh: () => Promise<void>
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined)

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
    const [customer, setCustomer] = useState<CustomerSession | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    // Check auth status on mount
    useEffect(() => {
        checkAuth()
    }, [])

    const checkAuth = async () => {
        try {
            const res = await fetch('/api/customer/auth/me')
            if (res.ok) {
                const data = await res.json() as { customer: CustomerSession }
                setCustomer(data.customer)
            } else {
                setCustomer(null)
            }
        } catch {
            setCustomer(null)
        } finally {
            setIsLoading(false)
        }
    }

    const login = async (identifier: string, password: string) => {
        try {
            const res = await fetch('/api/customer/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier, password }),
            })

            const data = await res.json() as { customer: CustomerSession; error?: string }

            if (res.ok) {
                setCustomer(data.customer)
                return { success: true }
            } else {
                return { success: false, error: data.error || 'Login gagal' }
            }
        } catch {
            return { success: false, error: 'Terjadi kesalahan jaringan' }
        }
    }

    const logout = async () => {
        try {
            await fetch('/api/customer/auth/logout', { method: 'POST' })
        } catch {
            // Ignore errors
        } finally {
            setCustomer(null)
            router.push('/login')
        }
    }

    const refresh = async () => {
        await checkAuth()
    }

    return (
        <CustomerAuthContext.Provider
            value={{
                customer,
                isLoading,
                isAuthenticated: !!customer,
                login,
                logout,
                refresh,
            }}
        >
            {children}
        </CustomerAuthContext.Provider>
    )
}

export function useCustomerAuth() {
    const context = useContext(CustomerAuthContext)
    if (context === undefined) {
        throw new Error('useCustomerAuth must be used within a CustomerAuthProvider')
    }
    return context
}
