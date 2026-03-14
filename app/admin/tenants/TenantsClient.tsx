'use client'

import { useState } from 'react'
import { HiOutlineBuildingOffice, HiOutlineShieldCheck } from 'react-icons/hi2'
import TenantList from './TenantList'
import TenantAdminList from './TenantAdminList'

export default function TenantsClient() {
    const [activeTab, setActiveTab] = useState<'tenants' | 'admins'>('tenants')
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null)

    const handleViewAdmins = (tenantId: string) => {
        setSelectedTenantId(tenantId)
        setActiveTab('admins')
    }

    return (
        <div className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('tenants')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
                            ${activeTab === 'tenants'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                        `}
                    >
                        <HiOutlineBuildingOffice className="w-5 h-5" />
                        Daftar Tenant
                    </button>
                    <button
                        onClick={() => setActiveTab('admins')}
                        className={`
                            whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2
                            ${activeTab === 'admins'
                                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
                        `}
                    >
                        <HiOutlineShieldCheck className="w-5 h-5" />
                        Administrator Tenant
                    </button>
                </nav>
            </div>

            <div className="mt-4 transition-all duration-300 ease-in-out">
                {activeTab === 'tenants' ? (
                    <TenantList onViewAdmins={handleViewAdmins} />
                ) : (
                    <TenantAdminList initialTenantId={selectedTenantId} />
                )}
            </div>
        </div>
    )
}
