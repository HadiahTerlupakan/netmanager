'use client'

import { useState } from 'react'
import { HiOutlineBanknotes, HiOutlineDocumentText } from 'react-icons/hi2'
import clsx from 'clsx'
import UnpaidBillsClient from '../unpaid/UnpaidBillsClient'
import ReceivablesClient from '../receivables/ReceivablesClient'

interface DebtsReceivablesClientProps {
  unpaidData: any[]
  receivablesData: any[]
  categories: any[]
  accounts: any[]
}

export default function DebtsReceivablesClient({ 
  unpaidData, 
  receivablesData, 
  categories, 
  accounts 
}: DebtsReceivablesClientProps) {
  const [activeTab, setActiveTab] = useState<'ap' | 'ar'>('ap')

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hutang & Piutang</h1>
           <p className="mt-2 text-gray-600 dark:text-gray-400">
             Monitor kewajiban pembayaran (AP) dan tagihan pelanggan (AR) dalam satu tempat.
           </p>
        </div>
        
        <div className="bg-gray-100 dark:bg-gray-800 p-1 rounded-xl inline-flex">
            <button
                onClick={() => setActiveTab('ap')}
                className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'ap' 
                        ? "bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm" 
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
            >
                <HiOutlineBanknotes className="w-5 h-5" />
                Hutang Usaha (AP)
            </button>
            <button
                onClick={() => setActiveTab('ar')}
                className={clsx(
                    "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                    activeTab === 'ar' 
                        ? "bg-white dark:bg-gray-700 text-emerald-600 dark:text-emerald-400 shadow-sm" 
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                )}
            >
                <HiOutlineDocumentText className="w-5 h-5" />
                Piutang Usaha (AR)
            </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
          {activeTab === 'ap' ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <UnpaidBillsClient 
                      initialData={unpaidData} 
                      categories={categories} 
                      accounts={accounts} 
                      hideHeader={true}
                  />
              </div>
          ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <ReceivablesClient 
                      initialData={receivablesData} 
                      hideHeader={true}
                  />
              </div>
          )}
      </div>
    </div>
  )
}
