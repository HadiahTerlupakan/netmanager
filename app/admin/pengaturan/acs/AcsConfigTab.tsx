"use client"

import { useState } from 'react'
import { Check, Info, RefreshCw } from 'lucide-react'

export function AcsConfigTab() {
  const [formData, setFormData] = useState({
    genieAcsUrl: 'http://113.192.1.34:7557/devices',
    vpPppoeUsername: 'VirtualParameters.pppoeUsername2',
    vpRxPower: 'VirtualParameters.RXPower',
    vpActiveDevices: 'VirtualParameters.activedevices',
    vpWanBridge: 'VirtualParameters.WANBridge',
    vpTemperature: 'VirtualParameters.gettemp',
    vpSuperAdmin: 'VirtualParameters.superAdmin',
    vpSuperPassword: 'VirtualParameters.superPassword',
    vpUserAdmin: 'VirtualParameters.userAdmin',
    vpUserPassword: 'VirtualParameters.userPassword',
    rxPowerExcellent: -23,
    rxPowerFair: -26,
    rxPowerPoor: -26,
    deviceDataInterval: 5.5,
    mappingDataInterval: 5.5,
    dashboardDataInterval: 5.5,
    deviceStatusInterval: 0.5,
    deviceOnlineThreshold: 10,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. GenieACS URL Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h3 className="text-[15px] font-bold text-gray-800">GenieACS URL Configuration</h3>
        </div>
        <div className="p-6">
          <div className="mb-6">
            <label className="block text-[13px] font-semibold text-gray-700 mb-2">GenieACS URL</label>
            <input 
              type="text" 
              name="genieAcsUrl"
              value={formData.genieAcsUrl}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-[14px]"
            />
            <p className="mt-2 text-[12px] text-gray-500">Enter the full URL to GenieACS devices endpoint (e.g. http://localhost:7557/devices)</p>
          </div>
          <div className="flex justify-end space-x-3">
            <button className="px-4 py-2 border border-blue-500 text-blue-600 rounded-md text-[13px] font-medium hover:bg-blue-50 flex items-center">
              <Check className="w-4 h-4 mr-1.5" /> Test URL
            </button>
            <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm">
              <Check className="w-4 h-4 mr-1.5" /> Save URL
            </button>
          </div>
        </div>
      </div>

      {/* 2. Virtual Parameters Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h3 className="text-[15px] font-bold text-gray-800">Virtual Parameters Configuration (Required)</h3>
        </div>
        <div className="p-6">
          <p className="text-[13px] text-gray-600 mb-6">
            Configure the virtual parameter names used in your GenieACS setup. <span className="text-red-500 font-bold">These parameters are required</span> for the application to work properly.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">PPPoE Username Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpPppoeUsername" value={formData.vpPppoeUsername} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">WAN Bridge Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpWanBridge" value={formData.vpWanBridge} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">RX Power Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpRxPower" value={formData.vpRxPower} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Temperature Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpTemperature" value={formData.vpTemperature} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Active Devices Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpActiveDevices" value={formData.vpActiveDevices} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Super Admin Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpSuperAdmin" value={formData.vpSuperAdmin} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Super Password Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpSuperPassword" value={formData.vpSuperPassword} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">User Admin Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpUserAdmin" value={formData.vpUserAdmin} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">User Password Parameter <span className="text-red-500">*</span></label>
              <input type="text" name="vpUserPassword" value={formData.vpUserPassword} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
            </div>
          </div>
          <div className="flex justify-end mt-8">
            <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm">
              <Check className="w-4 h-4 mr-1.5" /> Save Virtual Parameters
            </button>
          </div>
        </div>
      </div>

      {/* 3. Range RX Power Configuration */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h3 className="text-[15px] font-bold text-gray-800">Range RX Power Configuration</h3>
        </div>
        <div className="p-6">
          <p className="text-[13px] text-gray-600 mb-6">
            Configure the RX Power signal quality thresholds in dBm. These values determine how devices are categorized by signal strength.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Excellent Signal (&gt;= dBm) <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" name="rxPowerExcellent" value={formData.rxPowerExcellent} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Default: -21 dBm (Green)</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Fair Signal (&gt;= dBm) <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" name="rxPowerFair" value={formData.rxPowerFair} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Default: -25 dBm (Yellow)</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Poor Signal (&lt; dBm)</label>
              <div className="relative">
                <input type="text" readOnly value={`< ${formData.rxPowerFair}`} className="w-full px-3 py-2 border border-gray-300 bg-gray-50 rounded-md focus:outline-none text-[14px] text-gray-500" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">Auto: Anything below Fair (Red)</p>
            </div>
          </div>

          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-5 flex items-start space-x-3 mb-6">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-[13px] text-[#1e40af]">
              <p className="font-semibold mb-2">How RX Power Thresholds Work:</p>
              <ul className="list-disc pl-5 space-y-1 mb-2">
                <li><span className="font-semibold">Excellent (Green):</span> Signal &gt;= {formData.rxPowerExcellent} dBm</li>
                <li><span className="font-semibold">Fair (Yellow):</span> {formData.rxPowerExcellent} dBm &gt; Signal &gt;= {formData.rxPowerFair} dBm</li>
                <li><span className="font-semibold">Poor (Red):</span> Signal &lt; {formData.rxPowerFair} dBm</li>
              </ul>
              <p className="text-[12px] opacity-90">Note: More negative values = weaker signal (e.g., -25 is weaker than -21)</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm">
              <Check className="w-4 h-4 mr-1.5" /> Save RX Power Settings
            </button>
          </div>
        </div>
      </div>

      {/* 4. Auto Refresh Intervals */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-white">
          <h3 className="text-[15px] font-bold text-gray-800">Auto Refresh Intervals Configuration</h3>
        </div>
        <div className="p-6">
          <p className="text-[13px] text-gray-600 mb-6">
            Configure how often the application refreshes data automatically. Lower values provide more real-time updates but may increase server load.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6 mb-8">
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Device Data Refresh <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="0.1" name="deviceDataInterval" value={formData.deviceDataInterval} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-[13px]">min</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 flex items-center"><RefreshCw className="w-3 h-3 mr-1" /> Default: 5 minutes</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Mapping Data Refresh <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="0.1" name="mappingDataInterval" value={formData.mappingDataInterval} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-[13px]">min</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 flex items-center"><RefreshCw className="w-3 h-3 mr-1" /> Default: 5 minutes</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Dashboard Data Refresh <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="0.1" name="dashboardDataInterval" value={formData.dashboardDataInterval} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-[13px]">min</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 flex items-center"><RefreshCw className="w-3 h-3 mr-1" /> Default: 5 minutes</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Device Status Refresh <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="0.1" name="deviceStatusInterval" value={formData.deviceStatusInterval} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-[13px]">min</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 flex items-center">⚡ Default: 0.5 min (30 seconds)</p>
            </div>
            <div>
              <label className="block text-[13px] font-semibold text-gray-700 mb-2">Device Online Threshold <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="number" step="1" name="deviceOnlineThreshold" value={formData.deviceOnlineThreshold} onChange={handleChange} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 text-[14px]" />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-[13px]">min</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-gray-500 flex items-center">⏱️ Default: 10 minutes</p>
            </div>
          </div>

          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-lg p-5 flex items-start space-x-3 mb-6">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-[13px] text-[#1e40af]">
              <p className="font-semibold mb-2">How Auto Refresh Works:</p>
              <ul className="list-disc pl-5 space-y-1 mb-3">
                <li><span className="font-semibold">Device Data:</span> Auto-refresh device list every {formData.deviceDataInterval} minutes</li>
                <li><span className="font-semibold">Mapping Data:</span> Auto-refresh mapping table every {formData.mappingDataInterval} minutes</li>
                <li><span className="font-semibold">Dashboard Data:</span> Auto-refresh statistics every {formData.dashboardDataInterval} minutes</li>
                <li><span className="font-semibold">Device Status:</span> Real-time status check every {formData.deviceStatusInterval * 60} seconds</li>
                <li><span className="font-semibold">Online Threshold:</span> Devices are marked offline after {formData.deviceOnlineThreshold} minutes of inactivity</li>
              </ul>
              <p className="text-[12px] opacity-90">💡 Lower intervals = more real-time updates but higher server load. Recommended: Keep status check ≤ 1 minute for real-time monitoring.</p>
            </div>
          </div>

          <div className="flex justify-end">
            <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center shadow-sm">
              <Check className="w-4 h-4 mr-1.5" /> Save Refresh Intervals
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
