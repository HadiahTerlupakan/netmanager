"use client"

import { useState, useEffect, useRef } from 'react'
import { HiBell } from 'react-icons/hi2'
import { getWithExpiry } from '@/lib/utils/storage-with-expiry'
import NotificationDropdown from './NotificationDropdown'

interface Notification {
  id: string
  type: 'TAGIHAN' | 'STATUS' | 'PROMO'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}

interface NotificationBellProps {
  iconColor?: string
  hoverBg?: string
}

export default function NotificationBell({ iconColor, hoverBg }: NotificationBellProps = {}) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('pelanggan_token')
      const pelangganData = getWithExpiry<any>('pelanggan_data')
      
      if (!token || !pelangganData) {
        setLoading(false)
        return
      }

      const response = await fetch('/api/pelanggan/notifications', {
        cache: 'no-store',
        headers: {
          'x-pelanggan-token': token,
          'x-pelanggan-data': JSON.stringify(pelangganData),
        },
      })

      if (response.ok) {
        const data = await response.json()
        setNotifications(data.notifications || [])
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
    
    // Auto-fetch notifications every 60 seconds
    const interval = setInterval(fetchNotifications, 60000)
    
    // Refresh when window gains focus
    const handleFocus = () => fetchNotifications()
    window.addEventListener('focus', handleFocus)
    
    // Refresh when visibility changes
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const unreadCount = notifications.filter(n => !n.isRead).length

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 ${hoverBg || 'hover:bg-gray-100 dark:hover:bg-gray-800'} rounded-xl transition-all duration-200 active:scale-95 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation`}
        title="Notifikasi"
        aria-label="Notifikasi"
        aria-expanded={isOpen}
      >
        <HiBell className={`w-5 h-5 md:w-6 md:h-6 ${iconColor || 'text-gray-600 dark:text-gray-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full border-2 border-white dark:border-gray-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          onClose={() => setIsOpen(false)}
          onMarkAsRead={async (id: string) => {
            try {
              const token = localStorage.getItem('pelanggan_token')
              const pelangganData = getWithExpiry<any>('pelanggan_data')
              
              await fetch(`/api/pelanggan/notifications/${id}/read`, {
                method: 'POST',
                headers: {
                  'x-pelanggan-token': token || '',
                  'x-pelanggan-data': JSON.stringify(pelangganData),
                },
              })
              
              // Update local state
              setNotifications(prev => 
                prev.map(n => n.id === id ? { ...n, isRead: true } : n)
              )
            } catch (error) {
              console.error('Failed to mark notification as read:', error)
            }
          }}
          onRefresh={fetchNotifications}
        />
      )}
    </div>
  )
}

