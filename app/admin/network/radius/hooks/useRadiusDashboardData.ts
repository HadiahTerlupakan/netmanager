import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

import { useSocket, useSocketEvent } from '@/lib/websocket/SocketContext'

export interface RadiusDashboardStats {
  totalUsers: number
  onlineUsers: number
  offlineUsers: number
  totalTrafficToday: {
    download: string
    upload: string
    downloadGB: number
    uploadGB: number
  }
  lastSyncTime: string
  lastSyncStats: {
    created: number
    updated: number
    deleted: number
  }
}

export interface RadiusSession {
  radAcctId: string
  username: string | null
  nasIpAddress: string
  framedIpAddress: string | null
  acctStartTime: string | null
  uptimeHours: number
  downloadMB: number
  uploadMB: number
  isOnline: boolean
}

export function useRadiusDashboardData() {
  const { socket, isConnected } = useSocket()
  const { data: session } = useSession()
  const [stats, setStats] = useState<RadiusDashboardStats | null>(null)
  const [sessions, setSessions] = useState<RadiusSession[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true)
    try {
      const statsRes = await fetch('/api/admin/radius/dashboard/stats')
      const statsJson = await statsRes.json()
      const statsData = statsJson?.data ?? statsJson
      setStats(statsData)

      const sessionsRes = await fetch('/api/admin/radius/dashboard/recent-sessions?status=active&limit=50')
      const sessionsJson = await sessionsRes.json()
      const sessionsData = sessionsJson?.data ?? sessionsJson
      setSessions(sessionsData?.sessions || [])
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()

    if (socket && isConnected) {
      const tenantId = session?.user?.tenantId
      if (tenantId) {
        socket.emit('join_room', `admin:radius:${tenantId}`)
        console.log(`Joined admin:radius:${tenantId} room`)
      }
    }

    return () => {
      if (socket && isConnected) {
        const tenantId = session?.user?.tenantId
        if (tenantId) {
          socket.emit('leave_room', `admin:radius:${tenantId}`)
        }
      }
    }
  }, [fetchData, socket, isConnected, session?.user?.tenantId])

  const handleStatsUpdate = useCallback((newStats: RadiusDashboardStats) => {
    setStats(newStats)
  }, [])

  const handleSessionsUpdate = useCallback((data: { sessions: RadiusSession[]; total: number }) => {
    if (data && data.sessions) {
      setSessions(data.sessions)
    }
  }, [])

  useSocketEvent('radius:stats', handleStatsUpdate)
  useSocketEvent('radius:sessions', handleSessionsUpdate)

  return {
    stats,
    sessions,
    loading,
    refreshing,
    isConnected,
    refresh: fetchData,
  }
}
