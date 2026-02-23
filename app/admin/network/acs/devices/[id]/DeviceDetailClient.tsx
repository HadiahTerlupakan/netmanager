"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, RefreshCw, Activity, Power, Settings, Wifi, Globe, Key, X, AlertTriangle, Plus, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatDistanceToNow } from 'date-fns'

interface DeviceDetail {
  _id: string
  tags: string[]
  deviceInfo: {
    productClass: string | null
    serialNumber: string | null
    manufacturer: string | null
    oui: string | null
    hardwareVersion: string | null
    softwareVersion: string | null
    upTime: string | null
    macAddress: string | null
  }
  connectionInfo: {
    lastInform: string | null
    lastBoot: string | null
    registered: string | null
  }
  virtualParameters: {
    rxPower: string | null
    temperature: string | null
    pppoeUsername: string | null
    activeDevices: string | null
    wanbridge: string | null
  }
  wifiInfo: {
    wlan1: {
      enabled: boolean | string | null
      ssid: string | null
      password: string | null
    }
    wlan5: {
      enabled: boolean | string | null
      ssid: string | null
      password: string | null
    }
  }
}

// --- MODAL COMPONENTS ---
function ModalOverlay({ isOpen, onClose, title, children, width = "max-w-md" }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, width?: string }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${width} overflow-hidden animate-in fade-in zoom-in duration-200`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export function DeviceDetailClient({ deviceId }: { deviceId: string }) {
  const router = useRouter()
  const { showToast } = useToast()
  
  const [device, setDevice] = useState<DeviceDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- MODAL STATES ---
  const [paramModal, setParamModal] = useState({ isOpen: false, type: '', parameter: '', currentValue: '', title: '' })
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: '', title: '', message: '' })
  
  // Custom Modals matching the images
  const [wanModal, setWanModal] = useState({ isOpen: false, type: 'pppoe', name: '', vlan: '', user: '', pass: '' })
  const [ssidModal, setSsidModal] = useState({ isOpen: false, index: 1, name: '', security: 'WPA/WPA2', password: '', enabled: true })

  const fetchDeviceDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/acs/devices/${encodeURIComponent(deviceId)}`)
      const result = await res.json()
      if (result.success && result.data) {
        setDevice(result.data)
      } else {
        showToast('error', result.error || 'Gagal memuat detail perangkat')
        router.push('/admin/network/acs/devices')
      }
    } catch (_err) {
      showToast('error', 'Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeviceDetail()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId])

  // --- TASK EXECUTION ENGINE ---
  const executeTask = async (taskName: string, payload: Record<string, unknown> = {}) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/acs/devices/${encodeURIComponent(deviceId)}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskName, ...payload })
      })
      const result = await res.json()
      if (result.success) {
        showToast('success', 'Perintah berhasil dikirim ke perangkat!')
        setParamModal(p => ({...p, isOpen: false}))
        setConfirmModal(p => ({...p, isOpen: false}))
        setWanModal(p => ({...p, isOpen: false}))
        setSsidModal(p => ({...p, isOpen: false}))
        setTimeout(fetchDeviceDetail, 3000)
      } else {
        showToast('error', result.error || 'Gagal mengeksekusi perintah')
      }
    } catch (_e) {
      showToast('error', 'Terjadi kesalahan sistem')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatUptime = (secondsStr: string | null) => {
    if (!secondsStr) return '-'
    const seconds = parseInt(secondsStr, 10)
    if (isNaN(seconds)) return '-'
    
    const d = Math.floor(seconds / (3600*24))
    const h = Math.floor(seconds % (3600*24) / 3600)
    const m = Math.floor(seconds % 3600 / 60)
    
    const parts = []
    if (d > 0) parts.push(`${d}d`)
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    
    return parts.length > 0 ? parts.join(' ') : '< 1m'
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Memuat Data Perangkat...</p>
        <p className="text-sm text-gray-400 mt-2">Mengambil data realtime dari GenieACS</p>
      </div>
    )
  }

  if (!device) return null

  const dInfo = device.deviceInfo
  const vParams = device.virtualParameters
  const cInfo = device.connectionInfo
  const wifi = device.wifiInfo

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pt-4 pb-12 relative z-0">

      {/* ================= ALL PORTED MODALS ================= */}
      
      {/* Add WAN Modal */}
      <ModalOverlay isOpen={wanModal.isOpen} onClose={() => setWanModal(p => ({...p, isOpen: false}))} title="Add WAN Connection" width="max-w-[550px]">
        <div className="flex border-b border-gray-200 px-6 pt-2">
          {/* Interactive WAN Tabs */}
          <button 
            type="button"
            onClick={() => setWanModal(p => ({...p, type: 'pppoe'}))}
            className={`pb-3 px-4 font-bold text-[14px] ${wanModal.type === 'pppoe' ? 'text-[#a855f7] border-b-2 border-[#a855f7]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            WAN PPP (PPPoE)
          </button>
          <button 
            type="button"
            onClick={() => setWanModal(p => ({...p, type: 'bridge'}))}
            className={`pb-3 px-4 font-bold text-[14px] ${wanModal.type === 'bridge' ? 'text-[#a855f7] border-b-2 border-[#a855f7]' : 'text-gray-500 hover:text-gray-700'}`}
          >
            WAN Bridge
          </button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[13px] font-bold text-gray-800 mb-2">Connection Name <span className="text-gray-400 font-normal">(optional)</span></label>
            <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="e.g., INTERNET, IPTV, VOIP" />
          </div>
          <div>
            <label className="block text-[13px] font-bold text-gray-800 mb-2">VLAN ID</label>
            <input type="text" className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="e.g., 10, 112, 0" />
          </div>
          {wanModal.type === 'pppoe' && (
            <>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">PPP Username</label>
                <input type="text" value={wanModal.user} onChange={e => setWanModal(p => ({...p, user: e.target.value}))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="Your ISP username" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">PPP Password</label>
                <input type="password" value={wanModal.pass} onChange={e => setWanModal(p => ({...p, pass: e.target.value}))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="Your ISP password" />
              </div>
            </>
          )}

          <div className="pt-2">
            <h4 className="text-[13px] font-bold text-gray-800 mb-3">Interface Bindings</h4>
            <div className="mb-4">
              <label className="block text-[12px] font-bold text-gray-600 mb-2">LAN Ports</label>
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4].map(n => (
                  <div key={n} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center cursor-pointer hover:bg-gray-50">
                    <div className="w-5 h-5 border-2 border-gray-300 rounded mb-2"></div>
                    <span className="text-[11px] font-bold text-gray-800">LAN{n}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-bold text-gray-600 mb-2">WiFi Networks</label>
              <div className="grid grid-cols-4 gap-3">
                {[1,2,3,4,5,6,7,8].map(n => (
                  <div key={n} className="border border-gray-200 rounded-xl p-4 flex flex-col items-center cursor-pointer hover:bg-gray-50">
                    <div className="w-5 h-5 border-2 border-gray-300 rounded mb-2"></div>
                    <span className="text-[11px] font-bold text-gray-800">SSID{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-white flex justify-end space-x-3 border-t border-gray-100">
          <button onClick={() => setWanModal(p => ({...p, isOpen: false}))} className="px-6 py-2.5 bg-[#f1f5f9] text-gray-700 font-bold text-[14px] rounded-lg hover:bg-gray-200">Cancel</button>
          <button onClick={() => executeTask('setParameterValues', { parameter: vParams.pppoeUsername ? `VirtualParameters.${vParams.pppoeUsername.split('.').pop()}` : 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username', value: wanModal.user, type: 'string' })} disabled={isSubmitting || !wanModal.user} className="flex items-center px-6 py-2.5 bg-[#a855f7] text-white font-bold text-[14px] rounded-lg hover:bg-purple-600 disabled:opacity-50">
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create Connection
          </button>
        </div>
      </ModalOverlay>

      {/* Edit SSID Modal */}
      <ModalOverlay isOpen={ssidModal.isOpen} onClose={() => setSsidModal(p => ({...p, isOpen: false}))} title={`Edit SSID ${ssidModal.index} Configuration`} width="max-w-[500px]">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="text-[14px] font-bold text-gray-900">Enable SSID</h4>
              <p className="text-[13px] text-gray-500">WiFi network is active</p>
            </div>
            <div className="w-12 h-6 bg-[#a855f7] rounded-full flex items-center justify-end px-1 cursor-pointer">
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-gray-800 mb-2">Network Name (SSID)</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
              <input type="text" value={ssidModal.name} onChange={e => setSsidModal(p => ({...p, name: e.target.value}))} className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-[14px] focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <button onClick={() => executeTask('setParameterValues', { parameter: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', value: ssidModal.name })} className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-gray-800 mb-2">Security Type</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
              <select className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-[14px] focus:outline-none focus:ring-1 focus:ring-purple-500 bg-white">
                <option>WPA/WPA2</option>
              </select>
              <button className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
                <Check className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-gray-800 mb-2">Password</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
              <input type="text" value={ssidModal.password} onChange={e => setSsidModal(p => ({...p, password: e.target.value}))} className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-[14px] focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="Enter new password (leave empty to keep current)" />
              <button onClick={() => executeTask('setParameterValues', { parameter: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', value: ssidModal.password })} className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[12px] text-gray-600 mt-2 font-medium">Password is pre-filled from device if available. Leave empty to keep current password.</p>
            <p className="text-[12px] text-gray-500 mt-1">Leave empty to keep current password. New password must be 8-63 characters.</p>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end border-t border-gray-100 bg-white">
          <button onClick={() => setSsidModal(p => ({...p, isOpen: false}))} className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-[14px] rounded-lg transition-colors">Close</button>
        </div>
      </ModalOverlay>

      <ModalOverlay isOpen={paramModal.isOpen} onClose={() => setParamModal(p => ({...p, isOpen: false}))} title={paramModal.title} width="max-w-md">
        <div className="p-6">
          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">Nilai Baru</label>
          <input type="text" value={paramModal.currentValue} onChange={(e) => setParamModal(p => ({...p, currentValue: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Masukkan nilai..." />
          <p className="mt-3 text-[11px] text-gray-500">Perintah akan dikirim via TR-069. Perangkat mungkin akan terputus sesaat.</p>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
          <button onClick={() => setParamModal(p => ({...p, isOpen: false}))} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-md">Batal</button>
          <button onClick={() => executeTask('setParameterValues', { parameter: paramModal.parameter, value: paramModal.currentValue, type: 'string' })} disabled={isSubmitting || !paramModal.currentValue} className="flex items-center px-4 py-2 bg-[#a855f7] text-white font-medium text-sm rounded-md hover:bg-purple-700 disabled:opacity-50">
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} Simpan
          </button>
        </div>
      </ModalOverlay>

      <ModalOverlay isOpen={confirmModal.isOpen} onClose={() => setConfirmModal(p => ({...p, isOpen: false}))} title={confirmModal.title} width="max-w-md">
        <div className="p-6"><p className="text-[14px] text-gray-700">{confirmModal.message}</p></div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
          <button onClick={() => setConfirmModal(p => ({...p, isOpen: false}))} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-md">Batal</button>
          <button onClick={() => executeTask(confirmModal.action)} disabled={isSubmitting} className={`flex items-center px-4 py-2 text-white font-medium text-sm rounded-md disabled:opacity-50 ${confirmModal.action === 'reboot' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} Ya, Lanjutkan
          </button>
        </div>
      </ModalOverlay>
      {/* ================= END MODALS ================= */}

      
      {/* Top Header & Breadcrumb (ORIGINAL STYLE) */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Kembali ke Daftar</span>
        </button>
        <div className="flex space-x-2">
          <button 
            onClick={fetchDeviceDetail}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm cursor-pointer relative z-10"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Segarkan
          </button>
          <button 
            onClick={() => setConfirmModal({ isOpen: true, action: 'reboot', title: 'Reboot Device', message: 'Apakah Anda yakin ingin me-restart perangkat ini dari jarak jauh? Perangkat akan offline selama 1-3 menit.' })}
            className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-200 shadow-sm cursor-pointer relative z-10"
          >
            <Power className="w-4 h-4 mr-2" /> Reboot
          </button>
          <button 
            onClick={() => setConfirmModal({ isOpen: true, action: 'factoryReset', title: 'Factory Reset', message: 'PERINGATAN BAHAYA: Apakah Anda yakin ingin mereset perangkat ini ke pengaturan pabrik? Semua konfigurasi pelanggan (termasuk PPPoE) akan terhapus dan perangkat harus dikonfigurasi ulang.' })}
            className="flex items-center px-4 py-2 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-200 shadow-sm cursor-pointer relative z-10 ml-2"
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Factory Reset
          </button>
        </div>
      </div>

      {/* ORIGINAL SPLIT GRID LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Kolom Kiri: Info Utama */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#3b5fe5] to-blue-600 p-6 text-white text-center">
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto flex items-center justify-center backdrop-blur-sm mb-4">
                <Activity className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{dInfo.serialNumber || 'Unknown'}</h2>
              <p className="text-blue-100 font-medium mt-1">{dInfo.productClass || 'Router ONT'}</p>
            </div>
            
            <div className="p-6 divide-y divide-gray-100">
              <div className="py-3 flex justify-between">
                <span className="text-gray-500 text-sm">Vendor</span>
                <span className="font-semibold text-gray-900 text-sm">{dInfo.manufacturer || '-'}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-500 text-sm">MAC Address</span>
                <span className="font-semibold text-gray-900 text-sm font-mono">{dInfo.macAddress || '-'}</span>
              </div>
              <div className="py-3 flex justify-between">
                <span className="text-gray-500 text-sm">Uptime</span>
                <span className="font-semibold text-gray-900 text-sm">{formatUptime(dInfo.upTime)}</span>
              </div>
              <div className="py-3 flex justify-between items-center">
                <span className="text-gray-500 text-sm">Status</span>
                <span className="px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">Online</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden p-6">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider mb-4 flex items-center">
              <Settings className="w-4 h-4 mr-2 text-gray-500" /> System Info
            </h3>
            <div className="space-y-4">
              <div>
                <span className="block text-xs text-gray-400 mb-1">Hardware Version</span>
                <span className="text-sm font-medium text-gray-900">{dInfo.hardwareVersion || '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">Software Version</span>
                <span className="text-sm font-medium text-gray-900">{dInfo.softwareVersion || '-'}</span>
              </div>
              <div>
                <span className="block text-xs text-gray-400 mb-1">OUI</span>
                <span className="text-sm font-medium text-gray-900">{dInfo.oui || '-'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Parameter & Config */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Metrics - Reverted to Original White Borders */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">SINYAL OPTIK (RX)</div>
              <div className={`text-2xl font-bold ${vParams.rxPower && parseFloat(vParams.rxPower) < -26 ? 'text-red-500' : 'text-[#00c853]'}`}>
                {vParams.rxPower ? `${vParams.rxPower} dBm` : '-'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">SUHU ONT</div>
              <div className="text-2xl font-bold text-gray-900">
                {vParams.temperature ? `${vParams.temperature}°C` : '-'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">HOST AKTIF</div>
              <div className="text-2xl font-bold text-[#2962ff]">
                {vParams.activeDevices || '0'} Perangkat
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide text-center">TERAKHIR UPDATE</div>
              <div className="text-sm font-bold text-gray-900 mt-1 text-center">
                {cInfo.lastInform ? formatDistanceToNow(new Date(cInfo.lastInform), { addSuffix: true }) : '-'}
              </div>
            </div>
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* WiFi Config */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Wifi className="w-5 h-5 mr-2 text-purple-500" /> WLAN / WiFi Settings
                </h3>
                <span className="px-2 py-1 bg-purple-50 text-[#a855f7] text-[10px] font-bold rounded">2.4G & 5G</span>
              </div>
              <div className="p-5 space-y-5">
                {/* 2.4 GHz WiFi (SSID 1) */}
                <div className="bg-[#f8fafc] p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-gray-900 text-[15px]">SSID 1 (2.4 GHz)</span>
                    <span className="px-2.5 py-1 bg-[#dcfce7] text-[#166534] text-[11px] font-bold rounded">Active</span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[13px] text-gray-500 block mb-1">Nama WiFi</span>
                      <div className="font-semibold text-[15px] text-gray-900">{wifi.wlan1.ssid || '-'}</div>
                    </div>
                    <div>
                      <span className="text-[13px] text-gray-500 block mb-1">Password</span>
                      <div className="font-mono font-medium text-[15px] text-gray-900">{wifi.wlan1.password || '********'}</div>
                    </div>
                  </div>
                  <div className="mt-5 pt-4 border-t border-gray-200 flex gap-3 relative z-20">
                    <button 
                      onClick={() => setSsidModal({ isOpen: true, index: 1, name: wifi.wlan1.ssid || '', security: 'WPA/WPA2', password: '', enabled: true })}
                      className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-[13px] font-semibold hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Ubah Nama
                    </button>
                    <button 
                      onClick={() => setSsidModal({ isOpen: true, index: 1, name: wifi.wlan1.ssid || '', security: 'WPA/WPA2', password: '', enabled: true })}
                      className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-[13px] font-semibold hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Ubah Password
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* WAN & PPPoE Config */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Globe className="w-5 h-5 mr-2 text-blue-500" /> WAN Configuration
                </h3>
                <span className="px-2 py-1 bg-blue-50 text-[#2962ff] text-[10px] font-bold rounded">PPPoE / DHCP</span>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <span className="text-[13px] text-gray-500 block mb-1.5 font-medium">PPPoE Username</span>
                  <div className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-[15px] text-gray-900 shadow-sm">
                    {vParams.pppoeUsername || '-'}
                  </div>
                </div>
                <div>
                  <span className="text-[13px] text-gray-500 block mb-1.5 font-medium">WAN Mode</span>
                  <div className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg font-medium text-[15px] text-gray-900 shadow-sm">
                    {vParams.wanbridge || 'Route (PPPoE)'}
                  </div>
                </div>
                <div className="pt-3 relative z-20">
                  <button 
                    onClick={() => setWanModal({ isOpen: true, type: 'pppoe', name: '', vlan: '', user: vParams.pppoeUsername || '', pass: '' })}
                    className="w-full py-2.5 bg-[#2962ff] text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 flex justify-center items-center shadow-sm transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" /> Kelola WAN / Ganti PPPoE
                  </button>
                </div>
              </div>
            </div>

            {/* Admin Credential Config */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden md:col-span-2">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Key className="w-5 h-5 mr-2 text-orange-500" /> Device Credentials
                </h3>
              </div>
              <div className="p-6 flex flex-col md:flex-row gap-6 items-center justify-between">
                <p className="text-[14px] text-gray-600 max-w-lg leading-relaxed">
                  Ubah password untuk login ke halaman Web Admin (192.168.1.1) dari router ini secara remote.
                </p>
                <div className="relative z-20">
                  <button 
                    onClick={() => setParamModal({ isOpen: true, type: 'admin-pass', title: 'Ganti Password Admin', parameter: 'InternetGatewayDevice.UserInterface.Password', currentValue: '' })}
                    className="px-5 py-2.5 bg-white border border-[#f97316] text-[#ea580c] rounded-lg text-[13px] font-semibold hover:bg-orange-50 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
                  >
                    Ganti Password Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
