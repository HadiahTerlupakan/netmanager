import { Activity, AlertTriangle, ArrowLeft, Globe, Key, Power, RefreshCw, Settings, Wifi } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

import type { DeviceDetail } from '@/app/admin/network/acs/devices/lib/acsDeviceTypes'

type DeviceDetailPanelsProps = {
  device: DeviceDetail
  onBack: () => void
  onRefresh: () => void
  onOpenRebootConfirm: () => void
  onOpenFactoryResetConfirm: () => void
  onOpenSsidModal: () => void
  onOpenWanModal: () => void
  onOpenAdminPasswordModal: () => void
}

const formatUptime = (secondsStr: string | null) => {
  if (!secondsStr) return '-'
  const seconds = parseInt(secondsStr, 10)
  if (isNaN(seconds)) return '-'

  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)

  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)

  return parts.length > 0 ? parts.join(' ') : '< 1m'
}

export function DeviceDetailPanels({
  device,
  onBack,
  onRefresh,
  onOpenRebootConfirm,
  onOpenFactoryResetConfirm,
  onOpenSsidModal,
  onOpenWanModal,
  onOpenAdminPasswordModal,
}: DeviceDetailPanelsProps) {
  const dInfo = device.deviceInfo
  const vParams = device.virtualParameters
  const cInfo = device.connectionInfo
  const wifi = device.wifiInfo

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          <span className="text-sm font-medium">Kembali ke Daftar</span>
        </button>
        <div className="flex space-x-2">
          <button
            type="button"
            onClick={onRefresh}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm cursor-pointer relative z-10"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Segarkan
          </button>
          <button
            type="button"
            onClick={onOpenRebootConfirm}
            className="flex items-center px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-200 rounded-lg text-sm font-medium hover:bg-yellow-200 shadow-sm cursor-pointer relative z-10"
          >
            <Power className="w-4 h-4 mr-2" /> Reboot
          </button>
          <button
            type="button"
            onClick={onOpenFactoryResetConfirm}
            className="flex items-center px-4 py-2 bg-red-100 text-red-800 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-200 shadow-sm cursor-pointer relative z-10 ml-2"
          >
            <AlertTriangle className="w-4 h-4 mr-2" /> Factory Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
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

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">SINYAL OPTIK (RX)</div>
              <div className={`text-2xl font-bold ${vParams.rxPower && parseFloat(vParams.rxPower) < -26 ? 'text-red-500' : 'text-[#00c853]'}`}>
                {vParams.rxPower ? `${vParams.rxPower} dBm` : '-'}
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">SUHU ONT</div>
              <div className="text-2xl font-bold text-gray-900">{vParams.temperature ? `${vParams.temperature}°C` : '-'}</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide">HOST AKTIF</div>
              <div className="text-2xl font-bold text-[#2962ff]">{vParams.activeDevices || '0'} Perangkat</div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-center items-center">
              <div className="text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wide text-center">TERAKHIR UPDATE</div>
              <div className="text-sm font-bold text-gray-900 mt-1 text-center">
                {cInfo.lastInform ? formatDistanceToNow(new Date(cInfo.lastInform), { addSuffix: true }) : '-'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-gray-900 flex items-center">
                  <Wifi className="w-5 h-5 mr-2 text-purple-500" /> WLAN / WiFi Settings
                </h3>
                <span className="px-2 py-1 bg-purple-50 text-[#a855f7] text-[10px] font-bold rounded">2.4G & 5G</span>
              </div>
              <div className="p-5 space-y-5">
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
                      type="button"
                      onClick={onOpenSsidModal}
                      className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-[13px] font-semibold hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Ubah Nama
                    </button>
                    <button
                      type="button"
                      onClick={onOpenSsidModal}
                      className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-md text-[13px] font-semibold hover:bg-gray-50 transition-colors shadow-sm cursor-pointer"
                    >
                      Ubah Password
                    </button>
                  </div>
                </div>
              </div>
            </div>

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
                    type="button"
                    onClick={onOpenWanModal}
                    className="w-full py-2.5 bg-[#2962ff] text-white rounded-lg text-[13px] font-semibold hover:bg-blue-700 flex justify-center items-center shadow-sm transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 mr-2" /> Kelola WAN / Ganti PPPoE
                  </button>
                </div>
              </div>
            </div>

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
                    type="button"
                    onClick={onOpenAdminPasswordModal}
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
    </>
  )
}
