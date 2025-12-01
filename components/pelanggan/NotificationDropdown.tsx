"use client"

import { HiXMark, HiArrowRight, HiExclamationTriangle, HiCheckCircle, HiSparkles, HiBell } from 'react-icons/hi2'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { id as localeId } from 'date-fns/locale'

interface Notification {
  id: string
  type: 'TAGIHAN' | 'STATUS' | 'PROMO'
  title: string
  message: string
  isRead: boolean
  createdAt: string
  link?: string
}

interface NotificationDropdownProps {
  notifications: Notification[]
  loading: boolean
  onClose: () => void
  onMarkAsRead: (id: string) => Promise<void>
  onRefresh: () => void
}

export default function NotificationDropdown({
  notifications,
  loading,
  onClose,
  onMarkAsRead,
  onRefresh,
}: NotificationDropdownProps) {
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'TAGIHAN':
        return <HiExclamationTriangle className="w-5 h-5 text-orange-500" />
      case 'STATUS':
        return <HiCheckCircle className="w-5 h-5 text-blue-500" />
      case 'PROMO':
        return <HiSparkles className="w-5 h-5 text-purple-500" />
      default:
        return <HiExclamationTriangle className="w-5 h-5 text-gray-500" />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'TAGIHAN':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
      case 'STATUS':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'PROMO':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await onMarkAsRead(notification.id)
    }
  }

  return (
    <div className="absolute right-0 top-full mt-2 w-[calc(100vw-3rem)] md:w-80 lg:w-96 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[calc(100vh-8rem)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-base md:text-lg font-bold text-gray-900 dark:text-white">Notifikasi</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
            title="Refresh"
            aria-label="Refresh notifications"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close notifications"
          >
            <HiXMark className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white mx-auto"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Memuat notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <HiBell className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada notifikasi</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notification) => {
              const NotificationContent = (
                <div
                  className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer ${
                    !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center border ${getNotificationColor(notification.type)}`}>
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className={`text-sm font-semibold text-gray-900 dark:text-white ${!notification.isRead ? 'font-bold' : ''}`}>
                          {notification.title}
                        </h4>
                        {!notification.isRead && (
                          <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5"></span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-2 leading-relaxed">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: localeId,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )

              if (notification.link) {
                return (
                  <Link key={notification.id} href={notification.link}>
                    {NotificationContent}
                  </Link>
                )
              }

              return <div key={notification.id}>{NotificationContent}</div>
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/pelanggan/notifikasi"
            className="block text-center text-sm font-medium text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors touch-manipulation"
            onClick={onClose}
          >
            Lihat Semua Notifikasi
            <HiArrowRight className="w-4 h-4 inline-block ml-1" />
          </Link>
        </div>
      )}
    </div>
  )
}

