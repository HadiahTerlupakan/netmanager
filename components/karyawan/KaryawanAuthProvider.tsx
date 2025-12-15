'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signOut, useSession } from 'next-auth/react'

interface KaryawanSession {
    id: string
    name: string | null
    email: string
    departmentId: string | null
    siteId: string | null
}

interface KaryawanAuthContextType {
    user: KaryawanSession | null
    isLoading: boolean
    isAuthenticated: boolean
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
}

const KaryawanAuthContext = createContext<KaryawanAuthContextType | undefined>(undefined)

export function KaryawanAuthProvider({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession()
    const [user, setUser] = useState<KaryawanSession | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (status === 'authenticated' && session?.user) {
            setUser({
                id: (session.user as any).id,
                name: session.user.name ?? null,
                email: session.user.email ?? '',
                departmentId: (session.user as any).departmentId ?? null,
                siteId: (session.user as any).siteId ?? null,
            })
        } else if (status === 'unauthenticated') {
            setUser(null)
        }
    }, [session, status])

    const login = async (email: string, password: string) => {
        try {
            const result = await signIn('credentials', {
                identifier: email,
                password,
                redirect: false,
            })

            if (result?.ok) {
                return { success: true }
            } else {
                return { success: false, error: result?.error || 'Login gagal' }
            }
        } catch {
            return { success: false, error: 'Terjadi kesalahan jaringan' }
        }
    }

    const logout = async () => {
        await signOut({ redirect: false })
        router.push('/karyawan/login')
    }

    return (
        <KaryawanAuthContext.Provider
            value={{
                user,
                isLoading: status === 'loading',
                isAuthenticated: status === 'authenticated' && !!session?.user,
                login,
                logout,
            }}
        >
            {children}
        </KaryawanAuthContext.Provider>
    )
}

export function useKaryawanAuth() {
    const context = useContext(KaryawanAuthContext)
    if (context === undefined) {
        throw new Error('useKaryawanAuth must be used within a KaryawanAuthProvider')
    }
    return context
}
