"use client"
import { useEffect, useState } from 'react'
import OLTModal from '@/components/olt/OLTModal'

export default function OLTPage() {
  const [olts, setOlts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOlt, setSelectedOlt] = useState<any | null>(null)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')

  useEffect(() => {
    loadOlts()
  }, [])

  const loadOlts = async () => {
    try {
      const res = await fetch('/api/olts')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memuat data OLT' }))
        console.error('Error loading OLTs:', errorData.error)
        setOlts([])
        return
      }
      const data = await res.json()
      setOlts(data.olts || [])
    } catch (error) {
      console.error('Error loading OLTs:', error)
      setOlts([])
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setSelectedOlt(null)
    setModalMode('add')
    setIsModalOpen(true)
  }

  const handleEdit = (olt: any) => {
    setSelectedOlt(olt)
    setModalMode('edit')
    setIsModalOpen(true)
  }

  const handleSync = async (olt: any) => {
    if (!olt.snmpConnected) {
      alert('SNMP tidak connected. Silakan test connection terlebih dahulu.')
      return
    }

    if (!confirm(`Sync data dari ${olt.name}?`)) return

    try {
      const res = await fetch(`/api/olts/${olt.id}/sync`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal sync data')
        return
      }

      const result = await res.json()
      alert(`Sync berhasil!\n\nVersion: ${result.data.version || 'N/A'}\nTemperature: ${result.data.temperature || 'N/A'}°C\nConnected Devices: ${result.data.connectedDevices || 0}\nUptime: ${result.data.uptime || 'N/A'}`)
      
      // Refresh list
      await loadOlts()
    } catch (error: any) {
      console.error('Error syncing OLT:', error)
      alert('Terjadi kesalahan saat sync: ' + (error.message || 'Unknown error'))
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      if (modalMode === 'add') {
        const res = await fetch('/api/olts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Gagal menambah OLT')
          throw new Error('Failed to create OLT')
        }
      } else {
        const res = await fetch(`/api/olts/${selectedOlt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (!res.ok) {
          const error = await res.json()
          alert(error.error || 'Gagal mengupdate OLT')
          throw new Error('Failed to update OLT')
        }
      }
      await loadOlts()
    } catch (error) {
      console.error('Error submitting OLT:', error)
      throw error
    }
  }

  const formatUptime = (uptime: string | null) => {
    if (!uptime) return 'N/A'
    return uptime
  }

  const getSyncStatusColor = (status: string) => {
    const percentage = parseInt(status) || 0
    if (percentage === 100) return 'text-green-600 dark:text-green-400'
    if (percentage >= 50) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="mb-4 text-4xl">⏳</div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data OLT...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">OLTs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">OLTs</h2>
        </div>
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <span>➕</span>
          Tambah OLT
        </button>
      </div>

      {/* OLT Management Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">OLT Management</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  #
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  DEVICE
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  INFORMATION
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  SYNCHRONIZATION
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  CONNECTION
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  ACTION
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
              {olts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data OLT. Klik "Tambah OLT" untuk menambahkan.
                  </td>
                </tr>
              ) : (
                olts.map((olt, index) => (
                  <tr key={olt.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                          <span className="text-2xl">📡</span>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{olt.name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{olt.ipAddress}</div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {olt.version || 'N/A'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>🌡️</span>
                          <span>{olt.temperature ? `${olt.temperature}°C` : 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>📶</span>
                          <span>{olt.connectedDevices || 0} connected devices</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>💻</span>
                          <span>{olt.model || olt.type || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                          <span>⏰</span>
                          <span>{formatUptime(olt.uptime)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-16 relative">
                            <svg className="w-16 h-16 transform -rotate-90">
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                className="text-gray-200 dark:text-gray-700"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                strokeDasharray={`${(parseInt(olt.syncStatus) || 0) * 2 * Math.PI * 28} ${2 * Math.PI * 28}`}
                                className={getSyncStatusColor(olt.syncStatus)}
                              />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className={`text-xs font-semibold ${getSyncStatusColor(olt.syncStatus)}`}>
                                {olt.syncStatus || '0'}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                              <span>✓</span>
                              <span>Completed</span>
                            </div>
                            {olt.syncDate && (
                              <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs mt-1">
                                <span>📅</span>
                                <span>{new Date(olt.syncDate).toLocaleDateString('id-ID')}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="space-y-1">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            olt.telnetConnected
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          Telnet {olt.telnetConnected ? 'Connected' : 'Disconnected'}
                        </span>
                        <br />
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            olt.snmpConnected
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          SNMP {olt.snmpConnected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleSync(olt)}
                          disabled={!olt.snmpConnected}
                          className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Sync Data"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEdit(olt)}
                          className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Chip"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <OLTModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedOlt(null)
        }}
        onSubmit={handleSubmit}
        olt={selectedOlt}
        mode={modalMode}
        onTestSuccess={loadOlts}
      />
    </div>
  )
}
