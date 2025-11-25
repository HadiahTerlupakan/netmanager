import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { PelangganData } from '@/types/pelanggan'

export function usePelanggan() {
    const router = useRouter()
    const [data, setData] = useState<PelangganData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
    const isRefreshingRef = useRef(false)

    const loadData = useCallback(async (force = false, silent = false) => {
        if (!force && isRefreshingRef.current) return

        if (!silent) setLoading(true)
        setRefreshing(true)
        isRefreshingRef.current = true

        try {
            const token = localStorage.getItem('pelanggan_token')
            const storedData = localStorage.getItem('pelanggan_data')

            if (!token || !storedData) {
                router.push('/pelanggan/login')
                return
            }

            // Load from storage first untuk immediate display
            const parsedData = JSON.parse(storedData)
            setData(prevData => prevData || parsedData)

            // Fetch fresh data
            const response = await fetch('/api/pelanggan/me', {
                headers: {
                    'x-pelanggan-token': token,
                },
            })

            if (response.ok) {
                const freshData = await response.json()
                setData(freshData)
                localStorage.setItem('pelanggan_data', JSON.stringify(freshData))
                setLastRefreshTime(new Date())
            } else if (response.status === 401) {
                localStorage.removeItem('pelanggan_token')
                localStorage.removeItem('pelanggan_data')
                router.push('/pelanggan/login')
            }
        } catch (error) {
            console.error('Error loading pelanggan data:', error)
        } finally {
            setLoading(false)
            setRefreshing(false)
            isRefreshingRef.current = false
        }
    }, [router])

    // Initial load
    useEffect(() => {
        const storedData = localStorage.getItem('pelanggan_data')
        if (storedData) {
            try {
                const parsedData = JSON.parse(storedData)
                setData(parsedData)
                setLoading(false)
                // Background refresh setelah initial load
                loadData(true, true)
            } catch (e) {
                console.error('Error parsing stored data', e)
                router.push('/pelanggan/login')
            }
        } else {
            router.push('/pelanggan/login')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once on mount

    // Auto-refresh interval
    useEffect(() => {
        const interval = setInterval(() => {
            loadData(true, true)
        }, 30000)
        return () => clearInterval(interval)
    }, [loadData])

    return {
        data,
        loading,
        refreshing,
        lastRefreshTime,
        refresh: () => loadData(true, false),
    }
}
