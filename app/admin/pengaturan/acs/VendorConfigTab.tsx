"use client"

import { useState, useEffect } from 'react'
import { Package, Wifi, Plus, Edit, Trash2, X, RefreshCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { usePermission } from '@/hooks/use-permission'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObject = any;

function ModalOverlay({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-[800px] overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export function VendorConfigTab() {
  const { showToast } = useToast()
  const { hasPermission } = usePermission()
  const canUpdate = hasPermission('acs:update')

  const [vendors, setVendors] = useState<AnyObject[]>([])
  const [wifiConfigs, setWifiConfigs] = useState<AnyObject[]>([])
  const [activeSubTab, setActiveSubTab] = useState<'vendors' | 'wifi'>('vendors')
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Vendor Modal State
  const [vendorModal, setVendorModal] = useState<{ isOpen: boolean, isEdit: boolean, data: AnyObject }>({ isOpen: false, isEdit: false, data: {} })

  // WiFi Modal State
  const [wifiModal, setWifiModal] = useState<{ isOpen: boolean, isEdit: boolean, data: AnyObject }>({ isOpen: false, isEdit: false, data: {} })

  const fetchData = async () => {
    setLoading(true)
    try {
      const [vRes, wRes] = await Promise.all([
        fetch('/api/settings/acs/vendors').then(res => res.json()),
        fetch('/api/settings/acs/wifi-security').then(res => res.json())
      ])
      if (vRes.success) setVendors(vRes.data)
      if (wRes.success) setWifiConfigs(wRes.data)
    } catch (err) {
      console.error(err)
      showToast('error', 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- VENDOR ACTIONS ---
  const handleSaveVendor = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canUpdate) {
      showToast('error', 'Anda tidak memiliki hak akses')
      return
    }
    setIsSaving(true)
    try {
      const url = vendorModal.isEdit ? `/api/settings/acs/vendors/${vendorModal.data.id}` : '/api/settings/acs/vendors'
      const method = vendorModal.isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vendorModal.data)
      })
      const result = await res.json()

      if (result.success) {
        showToast('success', `Vendor berhasil ${vendorModal.isEdit ? 'diperbarui' : 'ditambahkan'}`)
        setVendorModal({ isOpen: false, isEdit: false, data: {} })
        fetchData()
      } else {
        showToast('error', result.error || 'Gagal menyimpan vendor')
      }
    } catch (_e) {
      showToast('error', 'Terjadi kesalahan sistem')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteVendor = async (id: string) => {
    if (!canUpdate) {
      showToast('error', 'Anda tidak memiliki hak akses')
      return
    }
    if (!confirm('Hapus vendor ini?')) return
    try {
      const res = await fetch(`/api/settings/acs/vendors/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Vendor berhasil dihapus')
        fetchData()
      }
    } catch (_e) {
      showToast('error', 'Gagal menghapus vendor')
    }
  }

  // --- WIFI SECURITY ACTIONS ---
  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canUpdate) {
      showToast('error', 'Anda tidak memiliki hak akses')
      return
    }
    setIsSaving(true)
    try {
      const url = wifiModal.isEdit ? `/api/settings/acs/wifi-security/${wifiModal.data.id}` : '/api/settings/acs/wifi-security'
      const method = wifiModal.isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wifiModal.data)
      })
      const result = await res.json()

      if (result.success) {
        showToast('success', `Konfigurasi WiFi berhasil ${wifiModal.isEdit ? 'diperbarui' : 'ditambahkan'}`)
        setWifiModal({ isOpen: false, isEdit: false, data: {} })
        fetchData()
      } else {
        showToast('error', result.error || 'Gagal menyimpan konfigurasi')
      }
    } catch (_e) {
      showToast('error', 'Terjadi kesalahan sistem')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteWifi = async (id: string) => {
    if (!canUpdate) {
      showToast('error', 'Anda tidak memiliki hak akses')
      return
    }
    if (!confirm('Hapus konfigurasi WiFi ini?')) return
    try {
      const res = await fetch(`/api/settings/acs/wifi-security/${id}`, { method: 'DELETE' })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Konfigurasi berhasil dihapus')
        fetchData()
      }
    } catch (_e) {
      showToast('error', 'Gagal menghapus konfigurasi')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden pb-12">
      <div className="px-6 py-6 border-b border-gray-100 bg-white">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-[22px] font-bold text-gray-900">Vendor Management</h2>
          <button onClick={fetchData} className="text-gray-500 hover:text-blue-600">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

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
                {canUpdate && (
                  <button
                    onClick={() => setVendorModal({ isOpen: true, isEdit: false, data: { name: '', priority: 10, enabled: true } })}
                    className="px-4 py-2 bg-[#a855f7] text-white rounded-md text-[13px] font-medium hover:bg-purple-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add Vendor
                  </button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">VENDOR INFORMATION</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">CONFIGURATION</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">DETECTION PATTERNS</th>
                    <th className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">PRIORITY</th>
                    <th className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {vendors.map((vendor: any) => (
                    <tr key={vendor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg bg-[#3b5fe5]">
                            {vendor.name ? vendor.name.charAt(0).toUpperCase() : 'V'}
                          </div>
                          <div className="ml-4">
                            <div className="text-[13px] font-bold text-gray-900">{vendor.name}</div>
                            {vendor.description && <div className="text-[12px] text-gray-500 mt-0.5">{vendor.description}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] text-gray-500 mb-1">Parameter Prefix</div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[12px] font-medium bg-[#f3e8ff] text-[#9333ea]">
                          {vendor.parameterPrefix || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#dbeafe] text-[#1e40af] mr-2">MFR</span>
                            <span className="text-[12px] text-gray-700">{vendor.manufacturerPatterns}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#dcfce7] text-[#166534] mr-2">PROD</span>
                            <span className="text-[12px] text-gray-700">{vendor.productPatterns}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-[14px] font-bold text-gray-700">
                        {vendor.priority}
                      </td>
                      <td className="px-6 py-4 text-center space-x-2">
                        {canUpdate && (
                          <>
                            <button onClick={() => setVendorModal({ isOpen: true, isEdit: true, data: { ...vendor } })} className="inline-flex items-center px-3 py-1.5 bg-[#3b5fe5] text-white rounded text-[12px] font-medium hover:bg-blue-700">
                              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                            </button>
                            <button onClick={() => handleDeleteVendor(vendor.id)} className="inline-flex items-center px-3 py-1.5 bg-[#ef4444] text-white rounded text-[12px] font-medium hover:bg-red-700">
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && !loading && (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-500">Tidak ada data vendor</td></tr>
                  )}
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
                {canUpdate && (
                  <button
                    onClick={() => setWifiModal({ isOpen: true, isEdit: false, data: { productClass: '', parameterPath: 'PreSharedKey.1.KeyPassphrase' } })}
                    className="px-4 py-2 bg-[#a855f7] text-white rounded-md text-[13px] font-medium hover:bg-purple-700 flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-1.5" /> Add WiFi Config
                  </button>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider w-1/3">PRODUCT CLASS</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">PASSWORD CONFIGURATION</th>
                    <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">SECURITY TYPES</th>
                    <th className="px-6 py-4 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {wifiConfigs.map((config: any) => (
                    <tr key={config.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#d946ef] flex items-center justify-center text-white">
                            <Wifi className="w-5 h-5" />
                          </div>
                          <div className="ml-4">
                            <div className="text-[13px] font-bold text-gray-900 leading-tight">{config.productClass}</div>
                            <div className="text-[12px] text-gray-500 mt-1">WiFi Security Configuration</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[12px] text-gray-500 mb-1">Parameter Path</div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-[#f3e8ff] text-[#9333ea]">
                          {config.parameterPath}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 flex-wrap">
                          {config.wpaTypes && <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-bold bg-[#dbeafe] text-[#1e40af]">{config.wpaTypes}</span>}
                          {config.encryptTypes && <span className="inline-flex items-center px-2 py-0.5 rounded text-[12px] font-bold bg-[#dbeafe] text-[#1e40af]">{config.encryptTypes}</span>}
                          {!config.wpaTypes && !config.encryptTypes && <span className="text-xs text-gray-400">None</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center space-x-2">
                        {canUpdate && (
                          <>
                            <button onClick={() => setWifiModal({ isOpen: true, isEdit: true, data: { ...config } })} className="inline-flex items-center px-3 py-1.5 bg-[#3b5fe5] text-white rounded text-[12px] font-medium hover:bg-blue-700">
                              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit
                            </button>
                            <button onClick={() => handleDeleteWifi(config.id)} className="inline-flex items-center px-3 py-1.5 bg-[#ef4444] text-white rounded text-[12px] font-medium hover:bg-red-700">
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                  {wifiConfigs.length === 0 && !loading && (
                    <tr><td colSpan={4} className="text-center py-6 text-gray-500">Tidak ada data konfigurasi WiFi</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Vendor Form Modal */}
      <ModalOverlay isOpen={vendorModal.isOpen} onClose={() => setVendorModal(p => ({ ...p, isOpen: false }))} title={vendorModal.isEdit ? 'Edit Vendor' : 'Add New Vendor'}>
        <form onSubmit={handleSaveVendor}>
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Vendor Name <span className="text-gray-400">*</span></label>
                <input type="text" required value={vendorModal.data.name || ''} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, name: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="e.g., Huawei, ZTE CT-COM" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Parameter Prefix <span className="text-gray-400">*</span></label>
                <input type="text" value={vendorModal.data.parameterPrefix || ''} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, parameterPrefix: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="e.g., X_HW, X_CT-COM" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Manufacturer Patterns (Comma-separated) <span className="text-gray-400">*</span></label>
                <input type="text" required value={vendorModal.data.manufacturerPatterns || ''} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, manufacturerPatterns: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="huawei, HUAWEI" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Product Patterns (Comma-separated) <span className="text-gray-400">*</span></label>
                <input type="text" required value={vendorModal.data.productPatterns || ''} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, productPatterns: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="eg8, hg8, hs8" />
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">WAN Connection Parameters</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-2">Service List Path</label>
                  <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-400" placeholder="X_HW_SERVICELIST" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-2">LAN Binding Path</label>
                  <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-400" placeholder="X_HW_LANBIND" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-2">VLAN ID Path</label>
                  <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-400" placeholder="X_HW_VLAN" />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-[14px] font-bold text-gray-900 mb-4">Security Parameters</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-2">HTTP WAN Enable Path</label>
                  <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-400" placeholder="InternetGatewayDevice.X_HW_Security..." />
                </div>
                <div>
                  <label className="block text-[13px] font-bold text-gray-800 mb-2">Firewall Level Path</label>
                  <input type="text" className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-400" placeholder="InternetGatewayDevice.X_HW_Security..." />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Priority</label>
                <input type="number" value={vendorModal.data.priority || 10} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, priority: parseInt(e.target.value) } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Status</label>
                <select className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] bg-white">
                  <option>Enabled</option>
                  <option>Disabled</option>
                </select>
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">Description</label>
                <input type="text" value={vendorModal.data.description || ''} onChange={e => setVendorModal(p => ({ ...p, data: { ...p.data, description: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="Optional description" />
              </div>
            </div>

          </div>
          <div className="px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
            <button type="button" onClick={() => setVendorModal(p => ({ ...p, isOpen: false }))} className="px-5 py-2 text-gray-700 font-bold text-[14px] hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex items-center px-5 py-2 bg-[#a855f7] text-white font-bold text-[14px] rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors shadow-sm">
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} {vendorModal.isEdit ? 'Update Vendor' : 'Create Vendor'}
            </button>
          </div>
        </form>
      </ModalOverlay>

      {/* WiFi Security Form Modal */}
      <ModalOverlay isOpen={wifiModal.isOpen} onClose={() => setWifiModal(p => ({ ...p, isOpen: false }))} title={wifiModal.isEdit ? 'Edit WiFi Security Config' : 'Add WiFi Security Config'}>
        <form onSubmit={handleSaveWifi}>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-[14px] font-bold text-gray-800 mb-2">Product Class <span className="text-gray-400">*</span> (Comma-separated for multiple)</label>
              <input type="text" required value={wifiModal.data.productClass || ''} onChange={e => setWifiModal(p => ({ ...p, data: { ...p.data, productClass: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px]" placeholder="e.g., HS8145C5, hg8245h, EG8145V5" />
              <p className="text-[12px] text-gray-500 mt-2 font-medium">Enter multiple product classes separated by commas</p>
            </div>
            <div>
              <label className="block text-[14px] font-bold text-gray-800 mb-2">Password Parameter Path <span className="text-gray-400">*</span></label>
              <input type="text" required value={wifiModal.data.parameterPath || ''} onChange={e => setWifiModal(p => ({ ...p, data: { ...p.data, parameterPath: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-500" placeholder="KeyPassphrase or PreSharedKey.1.KeyPassphrase" />
            </div>
            <div>
              <label className="block text-[14px] font-bold text-gray-800 mb-2">Security Types Mapping (JSON or comma-separated)</label>
              <input type="text" value={wifiModal.data.wpaTypes || ''} onChange={e => setWifiModal(p => ({ ...p, data: { ...p.data, wpaTypes: e.target.value } }))} className="w-full px-3.5 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-500 text-[14px] text-gray-500" placeholder="WPA/WPA2-PSK, WPA2-PSK" />
            </div>
          </div>
          <div className="px-6 py-4 flex justify-end space-x-3 border-t border-gray-100">
            <button type="button" onClick={() => setWifiModal(p => ({ ...p, isOpen: false }))} className="px-5 py-2 text-gray-700 font-bold text-[14px] hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors">Cancel</button>
            <button type="submit" disabled={isSaving} className="flex items-center px-5 py-2 bg-[#a855f7] text-white font-bold text-[14px] rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors shadow-sm">
              {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} {wifiModal.isEdit ? 'Update Config' : 'Create Config'}
            </button>
          </div>
        </form>
      </ModalOverlay>

    </div>
  )
}
