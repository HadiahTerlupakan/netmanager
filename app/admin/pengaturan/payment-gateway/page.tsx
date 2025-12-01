"use client"

import { useState } from 'react'
import { HiOutlineCreditCard, HiOutlineBanknotes } from 'react-icons/hi2'
import PaymentGatewayTab from './components/PaymentGatewayTab'
import ManualTransferTab from './components/ManualTransferTab'

export default function PaymentSettings() {
    const [activeTab, setActiveTab] = useState<'gateway' | 'manual'>('gateway')

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
            {/* Header */}
            <div className="max-w-6xl mx-auto mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Payment Settings
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Manage payment gateways and manual transfer bank accounts
                </p>
            </div>

            {/* Tabs */}
            <div className="max-w-6xl mx-auto mb-6">
                <div className="border-b border-gray-200 dark:border-gray-700">
                    <nav className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('gateway')}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'gateway'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <HiOutlineCreditCard className="w-5 h-5" />
                            Payment Gateway
                        </button>
                        <button
                            onClick={() => setActiveTab('manual')}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${activeTab === 'manual'
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                }`}
                        >
                            <HiOutlineBanknotes className="w-5 h-5" />
                            Manual Transfer (Bank Accounts)
                        </button>
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="max-w-6xl mx-auto">
                {activeTab === 'gateway' && <PaymentGatewayTab />}
                {activeTab === 'manual' && <ManualTransferTab />}
            </div>
        </div>
    )
}
