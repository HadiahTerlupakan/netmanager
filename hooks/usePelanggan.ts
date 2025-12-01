import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { PelangganData } from '@/types/pelanggan'
import { getWithExpiry, setWithExpiry, removeWithExpiry, migrateOldData } from '@/lib/utils/storage-with-expiry'

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
            
            // Jika tidak ada token, baru logout
            if (!token) {
                router.push('/pelanggan/login')
                return
            }

            // Coba ambil data dari storage (bisa null jika expired)
            const storedData = getWithExpiry<PelangganData>('pelanggan_data')
            
            // Load from storage first untuk immediate display (jika ada)
            if (storedData) {
                setData(prevData => prevData || storedData)
            }

            // Fetch fresh data dari API (selalu fetch jika ada token)
            const response = await fetch('/api/pelanggan/me', {
                cache: force ? 'no-store' : 'default',
                headers: {
                    'x-pelanggan-token': token,
                },
            })

            if (response.ok) {
                const freshData = await response.json()
                setData(freshData)
                // Simpan dengan expiry lebih lama (1 jam) untuk data pelanggan
                // Cache HTTP tetap 10 detik, tapi localStorage lebih lama
                setWithExpiry('pelanggan_data', freshData, 3600)
                setLastRefreshTime(new Date())
            } else if (response.status === 401) {
                // Token expired atau invalid, baru logout
                localStorage.removeItem('pelanggan_token')
                removeWithExpiry('pelanggan_data')
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
        const token = localStorage.getItem('pelanggan_token')
        
        // Jika tidak ada token, langsung logout
        if (!token) {
            router.push('/pelanggan/login')
            return
        }

        // Coba migrate data lama terlebih dahulu
        const migratedData = migrateOldData<PelangganData>('pelanggan_data', 3600)
        const storedData = migratedData || getWithExpiry<PelangganData>('pelanggan_data')
        
        if (storedData) {
            setData(storedData)
            setLoading(false)
        }
        
        // Background refresh setelah initial load (selalu fetch jika ada token)
        loadData(true, true)
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
