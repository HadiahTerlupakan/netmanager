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
        if (!force && (isRefreshingRef.current || loading)) return

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

            // Load from storage first
            const parsedData = JSON.parse(storedData)
            if (!data) setData(parsedData) // Set initial data if empty

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
    }, [router, data, loading])

    // Initial load
    useEffect(() => {
        const storedData = localStorage.getItem('pelanggan_data')
        if (storedData) {
            try {
                setData(JSON.parse(storedData))
                setLoading(false)
                loadData(true, true) // Background refresh
            } catch (e) {
                console.error('Error parsing stored data', e)
            }
        } else {
            router.push('/pelanggan/login')
        }
    }, [router]) // Run once on mount (loadData is stable enough or handled inside)

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
