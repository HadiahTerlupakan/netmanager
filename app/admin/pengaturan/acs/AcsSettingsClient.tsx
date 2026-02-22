"use client"

import { useState } from 'react'
import { AcsConfigTab } from './AcsConfigTab'
import { VendorConfigTab } from './VendorConfigTab'
import { Settings, Server, Cpu, User } from 'lucide-react'

export function AcsSettingsClient() {
  const [activeTab, setActiveTab] = useState<'acs' | 'vendor'>('acs')

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 pt-4">
      {/* Top Navigation Bar mimicking the original header */}
      <div className="bg-white rounded-lg border border-gray-200 p-2 flex items-center shadow-sm">
        <button className="flex-1 py-2 flex justify-center items-center text-[13px] font-semibold text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <Settings className="w-4 h-4 mr-2" /> App
        </button>
        <button 
          onClick={() => setActiveTab('acs')}
          className={"flex-1 py-2 flex justify-center items-center text-[13px] font-semibold rounded-md transition-colors " + (activeTab === 'acs' ? "bg-[#3b5fe5] text-white" : "text-gray-700 hover:bg-gray-50")}
        >
          <Server className="w-4 h-4 mr-2" /> ACS
        </button>
        <button 
          onClick={() => setActiveTab('vendor')}
          className={"flex-1 py-2 flex justify-center items-center text-[13px] font-semibold rounded-md transition-colors " + (activeTab === 'vendor' ? "bg-[#3b5fe5] text-white" : "text-gray-700 hover:bg-gray-50")}
        >
          <Cpu className="w-4 h-4 mr-2" /> Vendor
        </button>
        <button className="flex-1 py-2 flex justify-center items-center text-[13px] font-semibold text-gray-700 hover:bg-gray-50 rounded-md transition-colors">
          <User className="w-4 h-4 mr-2" /> User
        </button>
      </div>

      <div className="mt-6">
        {activeTab === 'acs' && <AcsConfigTab />}
        {activeTab === 'vendor' && <VendorConfigTab />}
      </div>
    </div>
  )
}
