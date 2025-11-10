"use client"

import { useEffect, useState } from 'react'
import OnuTypeModal from '@/components/onutype/OnuTypeModal'
import { HiExclamationCircle, HiArrowPath, HiEye, HiTrash, HiXMark } from 'react-icons/hi2'

type OnuType = {
  id: string
  oltId: string
  name: string
  ethernetPorts: number
  wifi: number
  voipPorts: number
  ponType?: string | null
  description?: string | null
  maxTcont?: number | null
  maxGemPort?: number | null
  maxSwitchPerSlot?: number | null
  maxFlowPerSwitch?: number | null
  maxIpHost?: number | null
  maxIpv6Host?: number | null
  serviceAbilityN1?: string | null
  serviceAbility1M?: string | null
  serviceAbility1P?: string | null
  wifiMgmtViaNonOmci?: string | null
  omciSendMode?: string | null
  defaultMulticastRange?: string | null
  vrg?: string | null
  mgcConfigureMode?: string | null
  maxVeip?: number | null
  extendedOmci?: string | null
  location?: string | null
}

type Olt = {
  id: string
  name: string
  ipAddress?: string
}

type OnuTypeWithOlt = OnuType & {
  olt: Olt
}

export default function OnuTypePage() {
  const [loading, setLoading] = useState(true)
  const [onuTypes, setOnuTypes] = useState<OnuTypeWithOlt[]>([])
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [selectedOlt, setSelectedOlt] = useState<Olt | null>(null)
  const [expandedOlts, setExpandedOlts] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [selectedOnuType, setSelectedOnuType] = useState<OnuTypeWithOlt | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [onuTypesRes, oltsRes] = await Promise.all([
        fetch('/api/onutypes'),
        fetch('/api/olts'),
      ])

      if (!onuTypesRes.ok) {
        let errorMessage = `Gagal memuat OnuTypes: ${onuTypesRes.status}`
        try {
          const errorData = await onuTypesRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          // Jika tidak bisa parse JSON, gunakan status text
          errorMessage = `Gagal memuat OnuTypes: ${onuTypesRes.status} ${onuTypesRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      if (!oltsRes.ok) {
        let errorMessage = `Gagal memuat OLTs: ${oltsRes.status}`
        try {
          const errorData = await oltsRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          errorMessage = `Gagal memuat OLTs: ${oltsRes.status} ${oltsRes.statusText || ''}`
        }
        throw new Error(errorMessage)
      }

      const onuTypesData = await onuTypesRes.json()
      const oltsData = await oltsRes.json()

      // Map onuTypes dengan olt data
      const onuTypesWithOlt: OnuTypeWithOlt[] = (onuTypesData.onuTypes || []).map((onuType: OnuType) => {
        const olt = oltsData.olts?.find((o: Olt) => o.id === onuType.oltId)
        return {
          ...onuType,
          olt: olt || { id: onuType.oltId, name: 'Unknown' },
        }
      })

      setOnuTypes(onuTypesWithOlt)
      const oltList = oltsData.olts || []
      setOlts(oltList.map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress })))
      
      // Auto-expand semua OLT yang memiliki OnuType saat pertama kali load
      const allOltIds = new Set(onuTypesWithOlt.map((ot) => ot.oltId))
      setExpandedOlts(allOltIds)
      setError(null)
    } catch (error: any) {
      console.error('Error loading data:', error)
      setError(error.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus OnuType ini?')) {
      return
    }

    try {
      const res = await fetch(`/api/onutypes/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus OnuType')
        return
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting OnuType:', error)
      alert('Terjadi kesalahan saat menghapus OnuType')
    }
  }

  const handleOltChange = (oltId: string) => {
    const olt = olts.find((o) => o.id === oltId)
    if (olt) {
      setSelectedOlt(olt)
      setSelectedOltId(olt.id)
      // Auto-expand OLT yang dipilih
      setExpandedOlts(new Set([olt.id]))
    } else {
      setSelectedOlt(null)
      setSelectedOltId('')
      // Jika tidak ada yang dipilih, expand semua
      const allOltIds = new Set(onuTypes.map((ot) => ot.oltId))
      setExpandedOlts(allOltIds)
    }
  }

  const toggleOlt = (oltId: string) => {
    setExpandedOlts((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(oltId)) {
        newSet.delete(oltId)
      } else {
        newSet.add(oltId)
      }
      return newSet
    })
  }

  const handleSyncFromSNMP = async () => {
    if (!selectedOltId) {
      alert('Silakan pilih OLT terlebih dahulu')
      return
    }

    if (!confirm('Apakah Anda yakin ingin sync ONU Type dari Telnet? Ini akan mengambil semua ONU type yang terdeteksi dari OLT menggunakan perintah "show onu-type".')) {
      return
    }

    try {
      setSyncing(true)
      setError(null)

      const res = await fetch(`/api/olts/${selectedOltId}/onutypes/sync`, {
        method: 'POST',
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Gagal sync ONU Type dari Telnet')
      }

      const result = await res.json()
      alert(`Berhasil sync ${result.data.syncedTypes} ONU types dari Telnet!\n\nTotal Types: ${result.data.totalTypes}\nSynced: ${result.data.syncedTypes}`)
      
      // Reload data setelah sync
      await loadData()
    } catch (error: any) {
      console.error('Error syncing ONU types:', error)
      setError(error.message || 'Gagal sync ONU Type dari Telnet')
      alert(error.message || 'Terjadi kesalahan saat sync ONU Type')
    } finally {
      setSyncing(false)
    }
  }

  // Filter onuTypes berdasarkan selectedOltId jika ada
  const filteredOnuTypes = selectedOltId
    ? onuTypes.filter((ot) => ot.oltId === selectedOltId)
    : onuTypes

  // Group onuTypes by oltId
  const groupedByOlt = filteredOnuTypes.reduce((acc, onuType) => {
    if (!acc[onuType.oltId]) {
      acc[onuType.oltId] = []
    }
    acc[onuType.oltId].push(onuType)
    return acc
  }, {} as Record<string, OnuTypeWithOlt[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Type</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Onu Type</h1>
      </div>

      {/* OLT Selection - Card terpisah seperti di halaman VLAN */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">Pilih OLT</label>
        <select
          value={selectedOltId}
          onChange={(e) => handleOltChange(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <option value="">-- Pilih OLT --</option>
          {olts.map((olt) => (
            <option key={olt.id} value={olt.id}>
              {olt.name} {olt.ipAddress ? `(${olt.ipAddress})` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <HiExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* List Type Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">List Type</h2>
          <div className="flex items-center gap-2">
            {selectedOltId && (
              <button
                onClick={handleSyncFromSNMP}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {syncing ? (
                  <>
                    <HiArrowPath className="animate-spin h-4 w-4" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <HiArrowPath className="w-4 h-4" />
                    Sync from SNMP
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <span>+</span>
              Create
            </button>
          </div>
        </div>

        {/* Collapsible OLT Sections */}
        {Object.keys(groupedByOlt).length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedOltId
                ? `Tidak ada data OnuType untuk OLT yang dipilih.`
                : 'Tidak ada data OnuType. Klik "Create" untuk menambahkan.'}
            </p>
          </div>
        ) : (
          Object.entries(groupedByOlt).map(([oltId, types]) => {
            const olt = types[0]?.olt
            const isExpanded = expandedOlts.has(oltId)

            return (
              <div
                key={oltId}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Collapsible Header */}
                <button
                  onClick={() => toggleOlt(oltId)}
                  className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                >
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">{olt?.name || 'Unknown OLT'}</span>
                  <span className={`text-gray-600 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ^
                  </span>
                </button>

                {/* Table Content */}
                {isExpanded && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            ONU Type
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Ethernet Ports
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Wifi
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            VoIP Ports
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {types.map((onuType, index) => (
                          <tr key={onuType.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                                {onuType.name}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {onuType.ethernetPorts}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {onuType.wifi}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {onuType.voipPorts}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSelectedOnuType(onuType)
                                    setIsDetailModalOpen(true)
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                  title="View Details"
                                >
                                  <HiEye className="w-5 h-5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(onuType.id)}
                                  className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Delete"
                                >
                                  <HiTrash className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Modal Create OnuType */}
      <OnuTypeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (data) => {
          try {
            const res = await fetch('/api/onutypes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}))
              throw new Error(errorData.error || 'Gagal menyimpan OnuType')
            }

            await loadData()
          } catch (err: any) {
            throw err
          }
        }}
      />

      {/* Modal Detail OnuType */}
      {selectedOnuType && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center ${isDetailModalOpen ? '' : 'hidden'}`}
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Detail ONU Type: {selectedOnuType.name}
              </h2>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Informasi Dasar
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ONU Type Name:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.name}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">PON Type:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.ponType || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Description:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.description || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ethernet Ports:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.ethernetPorts}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">WiFi:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.wifi}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">VoIP Ports:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.voipPorts}</p>
                    </div>
                  </div>
                </div>

                {/* Limits */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Batas Maksimum
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max T-CONT:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxTcont ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max GEM Port:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxGemPort ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Switch per Slot:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxSwitchPerSlot ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max Flow per Switch:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxFlowPerSwitch ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max IP Host:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxIpHost ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max IPv6 Host:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxIpv6Host ?? '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Max VEIP:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.maxVeip ?? '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Service Abilities */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Service Abilities
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Service Ability N:1:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.serviceAbilityN1 || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Service Ability 1:M:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.serviceAbility1M || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Service Ability 1:P:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.serviceAbility1P || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Configuration */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
                    Konfigurasi
                  </h3>
                  <div className="space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">WIFI mgmt via non OMCI:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.wifiMgmtViaNonOmci || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">OMCI send mode:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.omciSendMode || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Default multicast range:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.defaultMulticastRange || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">VRG:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.vrg || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">MGC configure mode:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.mgcConfigureMode || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Extended OMCI:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.extendedOmci || '-'}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Location:</span>
                      <p className="text-sm text-gray-900 dark:text-white">{selectedOnuType.location || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

