"use client"

import { useState } from 'react'
import { Package, Wifi, Download, Upload, Plus, Edit, Trash2 } from 'lucide-react'

const mockVendors = [
  { id: '1', name: 'FiberHome', desc: 'FiberHome Telecommunication Technologies ONT devices', prefix: 'X_FH', mfr: 'fh', prod: 'an5506, hg6145 +2', priority: 10, enabled: true, color: 'bg-blue-600', letter: 'F' },
  { id: '2', name: 'Huawei', desc: 'Huawei Technologies ONT devices', prefix: 'X_HW', mfr: 'huawei', prod: 'eg8, hg8 +2', priority: 10, enabled: true, color: 'bg-blue-500', letter: 'H' },
  { id: '3', name: 'NOKIA', desc: '', prefix: 'X_ALU-COM', mfr: 'ALCL', prod: 'G-', priority: 10, enabled: true, color: 'bg-blue-600', letter: 'N' },
  { id: '4', name: 'ZTE CT-COM', desc: 'ZTE China Telecom variant', prefix: 'X_CT-COM', mfr: 'zicg, ciot +2', prod: 'f663nv3a, GM219 +6', priority: 10, enabled: true, color: 'bg-[#3b5fe5]', letter: 'Z' },
  { id: '5', name: 'ZTE X_CU', desc: '', prefix: 'X_CU', mfr: 'ZXHN', prod: 'F477', priority: 10, enabled: true, color: 'bg-[#3b5fe5]', letter: 'Z' },
  { id: '6', name: 'ZTE X_ZTE-COM', desc: '', prefix: 'X_ZTE-COM', mfr: 'ZTE', prod: 'F670L, F609 +3', priority: 10, enabled: true, color: 'bg-[#3b5fe5]', letter: 'Z' },
  { id: '7', name: 'ZTE CMCC', desc: 'ZTE China Mobile variant', prefix: 'X_CMCC', mfr: 'zte', prod: 'f663nv9, F663NV3A', priority: 9, enabled: true, color: 'bg-[#3b5fe5]', letter: 'Z' },
]

export function VendorConfigTab() {
  const [vendors] = useState(mockVendors)
  const [activeSubTab, setActiveSubTab] = useState<'vendors' | 'wifi'>('vendors')

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden pb-12">
      <div className="px-6 py-6 border-b border-gray-100 bg-white">
        <h2 className="text-[22px] font-bold text-gray-900 mb-8">Vendor Management</h2>
        
        {/* Sub Tabs */}
        <div className="flex space-x-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveSubTab('vendors')}
            className={"flex items-center pb-3 text-[13px] font-bold " + (activeSubTab === 'vendors' ? "text-[#a855f7] border-b-2 border-[#a855f7]" : "text-gray-500 hover:text-gray-700")}
          >
            <Package className="w-4 h-4 mr-1.5" /> Vendors
          </button>
          <button 
            onClick={() => setActiveSubTab('wifi')}
            className={"flex items-center pb-3 text-[13px] font-bold " + (activeSubTab === 'wifi' ? "text-[#a855f7] border-b-2 border-[#a855f7]" : "text-gray-500 hover:text-gray-700")}
          >
            <Wifi className="w-4 h-4 mr-1.5" /> WiFi Security Config
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeSubTab === 'vendors' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">Vendors</h3>
                <p className="text-[13px] text-gray-500">All vendor parameter paths in one place!</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-[#16a34a] text-white rounded-md text-[13px] font-medium hover:bg-green-700 flex items-center">
                  <Download className="w-4 h-4 mr-1.5" /> Export
                </button>
                <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center">
                  <Upload className="w-4 h-4 mr-1.5" /> Import
                </button>
                <button className="px-4 py-2 bg-[#a855f7] text-white rounded-md text-[13px] font-medium hover:bg-purple-700 flex items-center">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Vendor
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">VENDOR INFORMATION</th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">CONFIGURATION</th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">DETECTION PATTERNS</th>
                    <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">PRIORITY</th>
                    <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">STATUS</th>
                    <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className={"flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg " + vendor.color}>
                            {vendor.letter}
                          </div>
                          <div className="ml-4">
                            <div className="text-[13px] font-bold text-gray-900">{vendor.name}</div>
                            {vendor.desc && <div className="text-[12px] text-gray-500 mt-0.5">{vendor.desc}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] text-gray-500 mb-1">Parameter Prefix</div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-[#f3e8ff] text-[#9333ea]">
                          {vendor.prefix}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center mb-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#dbeafe] text-[#1e40af] mr-2">MFR</span>
                          <span className="text-[12px] text-gray-700">{vendor.mfr}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#dcfce7] text-[#166534] mr-2">PROD</span>
                          <span className="text-[12px] text-gray-700">{vendor.prod}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-[14px] font-bold text-gray-700">
                        {vendor.priority}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-bold bg-[#dcfce7] text-[#166534]">
                          <span className="w-2 h-2 rounded-full bg-[#22c55e] mr-2"></span> Active
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center space-x-2">
                        <button className="inline-flex items-center px-3 py-1.5 bg-[#3b5fe5] text-white rounded text-[12px] font-medium hover:bg-blue-700">
                          <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                        </button>
                        <button className="inline-flex items-center px-3 py-1.5 bg-[#ef4444] text-white rounded text-[12px] font-medium hover:bg-red-700">
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'wifi' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">WiFi Security Configuration</h3>
                <p className="text-[13px] text-gray-500">Configure WiFi password paths per product class</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 bg-[#16a34a] text-white rounded-md text-[13px] font-medium hover:bg-green-700 flex items-center">
                  <Download className="w-4 h-4 mr-1.5" /> Export
                </button>
                <button className="px-4 py-2 bg-[#3b5fe5] text-white rounded-md text-[13px] font-medium hover:bg-blue-700 flex items-center">
                  <Upload className="w-4 h-4 mr-1.5" /> Import
                </button>
                <button className="px-4 py-2 bg-[#a855f7] text-white rounded-md text-[13px] font-medium hover:bg-purple-700 flex items-center">
                  <Plus className="w-4 h-4 mr-1.5" /> Add WiFi Config
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-1/3">PRODUCT CLASS</th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">PASSWORD CONFIGURATION</th>
                    <th scope="col" className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">SECURITY TYPES</th>
                    <th scope="col" className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#d946ef] flex items-center justify-center text-white">
                          <Wifi className="w-5 h-5" />
                        </div>
                        <div className="ml-4">
                          <div className="text-[13px] font-bold text-gray-900 leading-tight">F477V2 EPON,ZXHN F477,ZXHN F477V2</div>
                          <div className="text-[12px] text-gray-500 mt-1">WiFi Security Configuration</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-[12px] text-gray-500 mb-1">Parameter Path</div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#f3e8ff] text-[#9333ea]">
                        PreSharedKey.1.KeyPassphrase
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-bold bg-[#dbeafe] text-[#1e40af]">WPAand11i</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-bold bg-[#dbeafe] text-[#1e40af]">None</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center space-x-2">
                      <button className="inline-flex items-center px-3 py-1.5 bg-[#3b5fe5] text-white rounded text-[12px] font-medium hover:bg-blue-700">
                        <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                      </button>
                      <button className="inline-flex items-center px-3 py-1.5 bg-[#ef4444] text-white rounded text-[12px] font-medium hover:bg-red-700">
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
