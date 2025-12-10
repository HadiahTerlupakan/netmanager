'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  HiOutlineCube,
  HiOutlinePlus
} from 'react-icons/hi2'
import { TabNavigation } from '../../components/ui/TabNavigation'
import AmbilBarangForm from '../../components/inventory/AmbilBarangForm'
import EmployeeMasukForm from '../../components/inventory/EmployeeMasukForm'

export default function InventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('ambil')

  // Set active tab based on URL parameter
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && ['ambil', 'masuk'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams])

  const tabs = [
    {
      id: 'ambil',
      label: 'Ambil Barang',
      icon: <HiOutlineCube className="w-4 h-4" />
    },
    {
      id: 'masuk',
      label: 'Barang Masuk',
      icon: <HiOutlinePlus className="w-4 h-4" />
    }
  ]

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <HiOutlineCube className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Gudang</h1>
            <p className="text-indigo-100">
              Kelola pengambilan dan pemasukan barang
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
        <TabNavigation
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(tabId) => {
            setActiveTab(tabId)
            router.push(`/employee/inventory?tab=${tabId}`)
          }}
          variant="pills"
          className="bg-transparent"
        />
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        {activeTab === 'ambil' && <AmbilBarangForm />}
        {activeTab === 'masuk' && <EmployeeMasukForm />}
      </div>
    </div>
  )
}
