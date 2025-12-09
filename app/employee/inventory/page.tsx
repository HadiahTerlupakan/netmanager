'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  HiOutlineCube,
  HiOutlineArrowPath,
  HiOutlineArchiveBox,
  HiOutlineArrowRight,
  HiOutlinePlus
} from 'react-icons/hi2'
import { TabNavigation } from '../../components/ui/TabNavigation'
import AmbilBarangForm from '../../components/inventory/AmbilBarangForm'
import KembaliBarangForm from '../../components/inventory/KembaliBarangForm'
import EmployeeMasukForm from '../../components/inventory/EmployeeMasukForm'

export default function InventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState('ambil')

  // Set active tab based on URL parameter
 useEffect(() => {
    const tabFromUrl = searchParams.get('tab')
    if (tabFromUrl && ['ambil', 'kembali', 'masuk'].includes(tabFromUrl)) {
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
     id: 'kembali',
     label: 'Kembali Barang',
     icon: <HiOutlineArrowPath className="w-4 h-4" />
   },
   {
     id: 'masuk',
     label: 'Barang Masuk',
     icon: <HiOutlinePlus className="w-4 h-4" />
   }
 ]

 return (
   <div className="space-y-6">
     {/* Page Header */}
     <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
       <div className="flex items-center gap-3">
         <HiOutlineCube className="w-8 h-8" />
         <div>
           <h1 className="text-2xl font-bold">Gudang</h1>
           <p className="text-indigo-100">
             Kelola pengambilan dan pengembalian barang
           </p>
         </div>
       </div>
     </div>

     {/* Quick Actions */}
     <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
       <Link
         href="/employee/inventory/inventory-items"
         className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
       >
         <div className="flex items-center justify-between">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/30 transition-colors">
                 <HiOutlineArchiveBox className="w-6 h-6 text-blue-600 dark:text-blue-400" />
               </div>
               <div>
                 <h3 className="font-semibold text-gray-900 dark:text-white">
                   Inventaris Barang
                 </h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400">
                   Kelola data inventaris
                 </p>
               </div>
             </div>
             <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm">
               <span>Buka Inventaris</span>
               <HiOutlineArrowRight className="w-4 h-4" />
             </div>
           </div>
         </div>
       </Link>

       <Link
         href="/employee/inventory/returns"
         className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
       >
         <div className="flex items-center justify-between">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/30 transition-colors">
                 <HiOutlineArrowPath className="w-6 h-6 text-green-600 dark:text-green-400" />
               </div>
               <div>
                 <h3 className="font-semibold text-gray-900 dark:text-white">
                   Pengembalian Barang
                 </h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400">
                   Catat barang yang dikembalikan
                 </p>
               </div>
             </div>
             <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
               <span>Kelola Pengembalian</span>
               <HiOutlineArrowRight className="w-4 h-4" />
             </div>
           </div>
         </div>
       </Link>

       <Link
         href="/employee/inventory?tab=masuk"
         className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow group"
       >
         <div className="flex items-center justify-between">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg group-hover:bg-purple-200 dark:group-hover:bg-purple-900/30 transition-colors">
                 <HiOutlinePlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
               </div>
               <div>
                 <h3 className="font-semibold text-gray-900 dark:text-white">
                   Barang Masuk
                 </h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400">
                   Input barang baru ke gudang
                 </p>
               </div>
             </div>
             <div className="flex items-center gap-1 text-purple-600 dark:text-purple-400 text-sm">
               <span>Input Barang</span>
               <HiOutlineArrowRight className="w-4 h-4" />
             </div>
           </div>
         </div>
       </Link>
     </div>

     {/* Tab Navigation */}
     <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-2">
       <TabNavigation
         tabs={tabs}
         activeTab={activeTab}
         onTabChange={(tabId) => {
           setActiveTab(tabId)
           // Update URL with tab parameter
           router.push(`/employee/inventory?tab=${tabId}`)
         }}
         variant="pills"
         className="bg-transparent"
       />
     </div>

     {/* Tab Content */}
     <div className="min-h-[400px] bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
       {activeTab === 'ambil' && <AmbilBarangForm />}
       {activeTab === 'kembali' && <KembaliBarangForm />}
       {activeTab === 'masuk' && <EmployeeMasukForm />}
     </div>
   </div>
 )
}
