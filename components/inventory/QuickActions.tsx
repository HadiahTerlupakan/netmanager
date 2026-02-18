'use client'

import Link from 'next/link'
import { FiPlus, FiDownload, FiUpload, FiClipboard } from 'react-icons/fi'
import { usePermission } from '@/hooks/use-permission'

export function QuickActions() {
  const { hasPermission } = usePermission()

  const allActions = [
    {
      href: '/admin/inventory/barang/new',
      label: 'Tambah Barang',
      icon: <FiPlus className="w-5 h-5 text-white" />,
      color: 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400',
      permission: 'barang:create'
    },
    {
      href: '/admin/inventory/masuk',
      label: 'Barang Masuk',
      icon: <FiDownload className="w-5 h-5 text-white" />,
      color: 'bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-400',
      permission: 'stockmasuk:read'
    },
    {
      href: '/admin/inventory/keluar',
      label: 'Barang Keluar',
      icon: <FiUpload className="w-5 h-5 text-white" />,
      color: 'bg-orange-600 dark:bg-orange-500 hover:bg-orange-700 dark:hover:bg-orange-400',
      permission: 'stockkeluar:read'
    },
    {
      href: '/admin/inventory/opname',
      label: 'Stock Opname',
      icon: <FiClipboard className="w-5 h-5 text-white" />,
      color: 'bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-400',
      permission: 'stockopname:read'
    },
  ]

  const actions = allActions.filter(action => hasPermission(action.permission))

  if (actions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <Link
          key={index}
          href={action.href}
          className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white ${action.color} rounded-lg transition-colors`}
        >
          {action.icon}
          <span className="ml-2 text-white">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}