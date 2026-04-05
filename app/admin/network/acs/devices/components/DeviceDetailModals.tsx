import { Check, Plus, RefreshCw, X } from 'lucide-react'

type ModalOverlayProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string
}

type WanModalState = {
  isOpen: boolean
  type: string
  name: string
  vlan: string
  user: string
  pass: string
}

type SsidModalState = {
  isOpen: boolean
  index: number
  name: string
  security: string
  password: string
  enabled: boolean
}

type ParamModalState = {
  isOpen: boolean
  type: string
  parameter: string
  currentValue: string
  title: string
}

type ConfirmModalState = {
  isOpen: boolean
  action: string
  title: string
  message: string
}

type DeviceDetailModalsProps = {
  isSubmitting: boolean
  wanModal: WanModalState
  ssidModal: SsidModalState
  paramModal: ParamModalState
  confirmModal: ConfirmModalState
  setWanModal: React.Dispatch<React.SetStateAction<WanModalState>>
  setSsidModal: React.Dispatch<React.SetStateAction<SsidModalState>>
  setParamModal: React.Dispatch<React.SetStateAction<ParamModalState>>
  setConfirmModal: React.Dispatch<React.SetStateAction<ConfirmModalState>>
  onExecuteTask: (taskName: string, payload?: Record<string, unknown>) => void
  pppoeUsername: string | null
}

function ModalOverlay({ isOpen, onClose, title, children, width = 'max-w-md' }: ModalOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className={`bg-white rounded-xl shadow-2xl w-full ${width} overflow-hidden animate-in fade-in zoom-in duration-200`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}

export function DeviceDetailModals({
  isSubmitting,
  wanModal,
  ssidModal,
  paramModal,
  confirmModal,
  setWanModal,
  setSsidModal,
  setParamModal,
  setConfirmModal,
  onExecuteTask,
  pppoeUsername,
}: DeviceDetailModalsProps) {
  return (
    <>
      <ModalOverlay isOpen={wanModal.isOpen} onClose={() => setWanModal((prev) => ({ ...prev, isOpen: false }))} title="Add WAN Connection" width="max-w-[550px]">
        <div className="flex border-b border-gray-200 px-6 pt-2">
          <button type="button" onClick={() => setWanModal((prev) => ({ ...prev, type: 'pppoe' }))} className={`pb-3 px-4 font-bold text-[14px] ${wanModal.type === 'pppoe' ? 'text-[#a855f7] border-b-2 border-[#a855f7]' : 'text-gray-500 hover:text-gray-700'}`}>
            WAN PPP (PPPoE)
          </button>
          <button type="button" onClick={() => setWanModal((prev) => ({ ...prev, type: 'bridge' }))} className={`pb-3 px-4 font-bold text-[14px] ${wanModal.type === 'bridge' ? 'text-[#a855f7] border-b-2 border-[#a855f7]' : 'text-gray-500 hover:text-gray-700'}`}>
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
                <input type="text" value={wanModal.user} onChange={(event) => setWanModal((prev) => ({ ...prev, user: event.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="Your ISP username" />
              </div>
              <div>
                <label className="block text-[13px] font-bold text-gray-800 mb-2">PPP Password</label>
                <input type="password" value={wanModal.pass} onChange={(event) => setWanModal((prev) => ({ ...prev, pass: event.target.value }))} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-[14px] focus:ring-2 focus:ring-purple-500 focus:outline-none" placeholder="Your ISP password" />
              </div>
            </>
          )}

          <div className="pt-2">
            <h4 className="text-[13px] font-bold text-gray-800 mb-3">Interface Bindings</h4>
            <div className="mb-4">
              <label className="block text-[12px] font-bold text-gray-600 mb-2">LAN Ports</label>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((n) => (
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
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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
          <button type="button" onClick={() => setWanModal((prev) => ({ ...prev, isOpen: false }))} className="px-6 py-2.5 bg-[#f1f5f9] text-gray-700 font-bold text-[14px] rounded-lg hover:bg-gray-200">Cancel</button>
          <button
            type="button"
            onClick={() => onExecuteTask('setParameterValues', {
              parameter: pppoeUsername ? `VirtualParameters.${pppoeUsername.split('.').pop()}` : 'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
              value: wanModal.user,
              type: 'string',
            })}
            disabled={isSubmitting || !wanModal.user}
            className="flex items-center px-6 py-2.5 bg-[#a855f7] text-white font-bold text-[14px] rounded-lg hover:bg-purple-600 disabled:opacity-50"
          >
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Create Connection
          </button>
        </div>
      </ModalOverlay>

      <ModalOverlay isOpen={ssidModal.isOpen} onClose={() => setSsidModal((prev) => ({ ...prev, isOpen: false }))} title={`Edit SSID ${ssidModal.index} Configuration`} width="max-w-[500px]">
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
              <input type="text" value={ssidModal.name} onChange={(event) => setSsidModal((prev) => ({ ...prev, name: event.target.value }))} className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-[14px] focus:outline-none focus:ring-1 focus:ring-purple-500" />
              <button type="button" onClick={() => onExecuteTask('setParameterValues', { parameter: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', value: ssidModal.name })} className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
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
              <button type="button" className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
                <Check className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[14px] font-bold text-gray-800 mb-2">Password</label>
            <div className="flex shadow-sm rounded-lg overflow-hidden">
              <input type="text" value={ssidModal.password} onChange={(event) => setSsidModal((prev) => ({ ...prev, password: event.target.value }))} className="flex-1 px-4 py-2.5 border border-gray-300 border-r-0 rounded-l-lg text-[14px] focus:outline-none focus:ring-1 focus:ring-purple-500" placeholder="Enter new password (leave empty to keep current)" />
              <button type="button" onClick={() => onExecuteTask('setParameterValues', { parameter: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase', value: ssidModal.password })} className="px-5 bg-[#a855f7] text-white rounded-r-lg hover:bg-purple-600 transition-colors">
                {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[12px] text-gray-600 mt-2 font-medium">Password is pre-filled from device if available. Leave empty to keep current password.</p>
            <p className="text-[12px] text-gray-500 mt-1">Leave empty to keep current password. New password must be 8-63 characters.</p>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end border-t border-gray-100 bg-white">
          <button type="button" onClick={() => setSsidModal((prev) => ({ ...prev, isOpen: false }))} className="px-6 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-[14px] rounded-lg transition-colors">Close</button>
        </div>
      </ModalOverlay>

      <ModalOverlay isOpen={paramModal.isOpen} onClose={() => setParamModal((prev) => ({ ...prev, isOpen: false }))} title={paramModal.title} width="max-w-md">
        <div className="p-6">
          <label htmlFor="device-param-value" className="block text-[13px] font-semibold text-gray-700 mb-1.5">Nilai Baru</label>
          <input id="device-param-value" type="text" value={paramModal.currentValue} onChange={(event) => setParamModal((prev) => ({ ...prev, currentValue: event.target.value }))} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Masukkan nilai..." />
          <p className="mt-3 text-[11px] text-gray-500">Perintah akan dikirim via TR-069. Perangkat mungkin akan terputus sesaat.</p>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
          <button type="button" onClick={() => setParamModal((prev) => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-md">Batal</button>
          <button type="button" onClick={() => onExecuteTask('setParameterValues', { parameter: paramModal.parameter, value: paramModal.currentValue, type: 'string' })} disabled={isSubmitting || !paramModal.currentValue} className="flex items-center px-4 py-2 bg-[#a855f7] text-white font-medium text-sm rounded-md hover:bg-purple-700 disabled:opacity-50">
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} Simpan
          </button>
        </div>
      </ModalOverlay>

      <ModalOverlay isOpen={confirmModal.isOpen} onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} title={confirmModal.title} width="max-w-md">
        <div className="p-6"><p className="text-[14px] text-gray-700">{confirmModal.message}</p></div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end space-x-3 border-t border-gray-100">
          <button type="button" onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-gray-600 font-medium text-sm hover:bg-gray-100 rounded-md">Batal</button>
          <button type="button" onClick={() => onExecuteTask(confirmModal.action)} disabled={isSubmitting} className={`flex items-center px-4 py-2 text-white font-medium text-sm rounded-md disabled:opacity-50 ${confirmModal.action === 'reboot' ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-red-600 hover:bg-red-700'}`}>
            {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : null} Ya, Lanjutkan
          </button>
        </div>
      </ModalOverlay>
    </>
  )
}
