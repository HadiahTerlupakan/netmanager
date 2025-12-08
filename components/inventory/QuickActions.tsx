'use client'

import Link from 'next/link'
import { FiPlus, FiDownload, FiUpload, FiClipboard } from 'react-icons/fi'

export function QuickActions() {
  const actions = [
    {
      href: '/admin/inventory/barang/new',
      label: 'Tambah Barang',
      icon: <FiPlus className="w-5 h-5" />,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      href: '/admin/inventory/masuk',
      label: 'Barang Masuk',
      icon: <FiDownload className="w-5 h-5" />,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      href: '/admin/inventory/keluar',
      label: 'Barang Keluar',
      icon: <FiUpload className="w-5 h-5" />,
      color: 'bg-orange-600 hover:bg-orange-700'
    },
    {
      href: '/admin/inventory/opname',
      label: 'Stock Opname',
      icon: <FiClipboard className="w-5 h-5" />,
      color: 'bg-purple-600 hover:bg-purple-700'
    },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <Link
          key={index}
          href={action.href}
          className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white ${action.color} rounded-lg transition-colors`}
        >
          {action.icon}
          <span className="ml-2">{action.label}</span>
        </Link>
      ))}
    </div>
  )
}