import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

interface FinanceUser {
    id: string
    email: string
    name: string | null
    role: string
}

export function useFinance() {
    const router = useRouter()
    const { data: session, status } = useSession()
    const [data, setData] = useState<FinanceUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
    const isRefreshingRef = useRef(false)

    const loadData = useCallback(async (force = false, silent = false) => {
        if (!force && isRefreshingRef.current) return
        if (status === 'loading') return

        if (!silent) setLoading(true)
        setRefreshing(true)
        isRefreshingRef.current = true

        try {
            if (status === 'unauthenticated' || !session?.user) {
                router.push('/finance/login')
                return
            }

            // Use session data directly
            const user = session.user as any

            // Check if user has finance access (ADMIN or FINANCE role)
            const role = user.role || 'USER'
            if (role !== 'ADMIN' && role !== 'FINANCE') {
                router.push('/finance/login?error=unauthorized')
                return
            }

            setData({
                id: user.id || '',
                email: user.email || '',
                name: user.name || null,
                role: role,
            })
            setLastRefreshTime(new Date())
        } catch (error) {
            console.error('Error loading finance data:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
            isRefreshingRef.current = false
        }
    }, [router, session, status])

    // Wait for session to load
    useEffect(() => {
        if (status === 'loading') {
            setLoading(true)
            return
        }

        if (status === 'unauthenticated') {
            router.push('/finance/login')
            return
        }

        if (status === 'authenticated' && session?.user) {
            loadData(true, false)
        }
    }, [status, session, loadData, router])

    // Auto-refresh interval
    useEffect(() => {
        if (status !== 'authenticated') return

        const interval = setInterval(() => {
            loadData(true, true)
        }, 30000)
        return () => clearInterval(interval)
    }, [loadData, status])

    return {
        data,
        loading: loading || status === 'loading',
        refreshing,
        lastRefreshTime,
        refresh: () => loadData(true, false),
    }
}
