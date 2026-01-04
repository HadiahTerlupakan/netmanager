"use client"
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import OLTModal from '@/components/olt/OLTModal'
import { HiOutlinePlus, HiOutlineSignal, HiArrowPath, HiPencil, HiOutlineCpuChip, HiOutlineFire, HiOutlineSignal as HiSignal, HiOutlineComputerDesktop, HiOutlineClock, HiCheck, HiOutlineCalendar, HiTrash, HiEye, HiOutlineTableCells, HiXMark, HiExclamationTriangle, HiInformationCircle } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'
import { useSocket, useSocketEvent } from '@/lib/websocket/SocketContext'

export default function OLTList() {
  const router = useRouter()
  const [olts, setOlts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedOlt, setSelectedOlt] = useState<any | null>(null)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [viewOlt, setViewOlt] = useState<any | null>(null)
  const [onus, setOnus] = useState<any[]>([])
  const [loadingOnus, setLoadingOnus] = useState(false)
  const [onuPagination, setOnuPagination] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null)
  // SNMP TABLE test modal state
  const [testTableModalOpen, setTestTableModalOpen] = useState(false)
  const [testTableLoading, setTestTableLoading] = useState(false)
  const [testTableResult, setTestTableResult] = useState<any>(null)
  const [testTableError, setTestTableError] = useState<string | null>(null)
  const [selectedOnuForTest, setSelectedOnuForTest] = useState<any | null>(null)
  useEffect(() => {
    loadOlts()
  }, [])

  const loadOlts = async () => {
    try {
      // Tambahkan cache busting untuk memastikan data selalu terbaru
      const res = await fetch('/api/olts', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })
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

    if (!confirm(`Sync data dari ${olt.name}? Sync akan berjalan di background.`)) return

    try {
      const res = await fetch(`/api/olts/${olt.id}/sync`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal memulai sync')
        return
      }

      const result = await res.json()

      // Tampilkan pesan bahwa sync dimulai di background
      alert(`Sync dimulai di background untuk ${result.oltName || olt.name}.\n\nProgress dapat dilihat di kolom "Synchronization Status".\nHalaman akan otomatis refresh setiap 3 detik untuk melihat progress.`)

      // Refresh list untuk melihat progress awal
      await loadOlts()

      // Start auto-refresh untuk melihat progress sync
      startAutoRefresh(olt.id)
    } catch (error: any) {
      console.error('Error starting sync:', error)
      alert('Terjadi kesalahan saat memulai sync: ' + (error.message || 'Unknown error'))
    }
  }

  const { socket, isConnected } = useSocket()

  // WebSocket Listeners
  useSocketEvent<{ oltId: string; progress: string }>('olt:sync:progress', ({ oltId, progress }) => {
    setOlts(prev => prev.map(o => {
      if (o.id === oltId) {
        return { ...o, syncStatus: progress }
      }
      return o
    }))
  })

  useSocketEvent('olt:updated', () => {
    loadOlts()
  })

  // Auto-refresh removed in favor of WebSockets
  const startAutoRefresh = (oltId: string) => {
    // Legacy auto-refresh fallback (optional, or just empty if we trust WS 100%)
  }

  const runAutoConnectionTest = async (oltId: string, formData: any) => {
    try {
      const response = await fetch('/api/olts/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oltId,
          ipAddress: formData.ipAddress,
          snmpPort: formData.snmpPort ?? 161,
          snmpCommunityWrite: formData.snmpCommunityWrite || 'public',
          snmpVersion: formData.snmpVersion || '2',
          telnetPort: formData.telnetPort ?? 23,
          telnetUsername: formData.telnetUsername || 'zte',
          telnetPassword: formData.telnetPassword || '',
        }),
      })

      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMessage = (result && (result.error as string)) || 'Test connection gagal'
        return { success: false, error: errorMessage }
      }

      return result
    } catch (error: any) {
      console.error('Auto test connection gagal:', error)
      return { success: false, error: error?.message || 'Test connection gagal' }
    }
  }

  // Fungsi untuk test SNMP TABLE
  const handleTestSnmpTable = async (onu: any) => {
    if (!onu.statusOid || !onu.compositeIndex) {
      alert('ONU belum memiliki OID yang tersimpan. Silakan sync ONU terlebih dahulu.')
      return
    }

    setSelectedOnuForTest(onu)
    setTestTableModalOpen(true)
    setTestTableLoading(true)
    setTestTableResult(null)
    setTestTableError(null)

    try {
      const res = await fetch('/api/onus/test-table', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          onuId: onu.gponOnu,
          oltId: viewOlt?.id,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setTestTableResult(data)
      } else {
        setTestTableError(data.error || 'Gagal test SNMP TABLE')
      }
    } catch (error: any) {
      setTestTableError(error.message || 'Gagal test SNMP TABLE')
    } finally {
      setTestTableLoading(false)
    }
  }

  const handleView = async (olt: any) => {
    setViewOlt(olt)
    setIsViewModalOpen(true)
    setLoadingOnus(true)
    setOnus([])

    try {
      // Fetch ONU data dari database untuk OLT ini (bukan dari SNMP)
      // Gunakan limit yang lebih besar (2000) untuk memastikan semua ONU terlihat
      const res = await fetch(`/api/onus/database?oltId=${olt.id}&limit=2000&page=1`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Gagal memuat data ONU' }))
        alert(error.error || 'Gagal memuat data ONU')
        return
      }

      const data = await res.json()
      setOnus(data.onus || [])
      setOnuPagination(data.pagination || null)
    } catch (error: any) {
      console.error('Error loading ONUs:', error)
      alert('Terjadi kesalahan saat memuat data ONU: ' + (error.message || 'Unknown error'))
    } finally {
      setLoadingOnus(false)
    }
  }

  const handleDelete = async (olt: any) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus OLT "${olt.name}"?\n\nTindakan ini tidak dapat dibatalkan dan akan menghapus semua data terkait OLT ini.`)) {
      return
    }

    try {
      const res = await fetch(`/api/olts/${olt.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus OLT')
        return
      }

      // Refresh list setelah hapus berhasil
      await loadOlts()
      alert('OLT berhasil dihapus')
    } catch (error: any) {
      console.error('Error deleting OLT:', error)
      alert('Terjadi kesalahan saat menghapus OLT: ' + (error.message || 'Unknown error'))
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
        const result = await res.json().catch(() => ({}))
        if (!res.ok) {
          alert((result && result.error) || 'Gagal menambah OLT')
          throw new Error('Failed to create OLT')
        }

        if (result?.id) {
          const connectionResult = await runAutoConnectionTest(result.id as string, data)
          if (connectionResult) {
            if ('error' in connectionResult && connectionResult.error) {
              alert(
                `OLT berhasil dibuat, namun test connection otomatis gagal: ${connectionResult.error}`
              )
            } else if (
              connectionResult.snmp &&
              connectionResult.snmp.success === false &&
              connectionResult.snmp.message
            ) {
              alert(
                `OLT berhasil dibuat, namun SNMP belum terhubung: ${connectionResult.snmp.message}`
              )
            }
          }
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
      // Refresh data setelah submit berhasil
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
    return <PageLoader />
  }

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">OLTs</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">OLT Management</h1>
        <button
          onClick={loadOlts}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <HiArrowPath className="w-4 h-4" />
          Refresh Now
        </button>
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
          <HiOutlinePlus className="w-4 h-4" />
          Tambah OLT
        </button>
      </div>

      {/* OLT Management Table */}
      <ResponsiveTable
        data={olts}
        keyField="id"
        columns={[
          {
            key: 'index',
            header: '#',
            priority: 'tertiary',
            render: (_: any, index: number) => <span className="text-gray-600 dark:text-gray-400">{index + 1}</span>
          },
          {
            key: 'device',
            header: 'DEVICE',
            priority: 'primary',
            render: (olt: any) => (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center shrink-0">
                  <HiOutlineSignal className="text-2xl" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{olt.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{olt.ipAddress}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {olt.version || 'N/A'}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'info',
            header: 'INFORMATION',
            priority: 'secondary',
            render: (olt: any) => (
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <HiOutlineFire className="w-4 h-4 shrink-0" />
                  <span>{olt.temperature ? `${olt.temperature}°C` : 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <HiSignal className="w-4 h-4 shrink-0" />
                  <span>{olt.connectedDevices || 0} connected devices</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <HiOutlineComputerDesktop className="w-4 h-4 shrink-0" />
                  <span>{olt.model || olt.type || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <HiOutlineClock className="w-4 h-4 shrink-0" />
                  <span>{formatUptime(olt.uptime)}</span>
                </div>
              </div>
            )
          },
          {
            key: 'sync',
            header: 'SYNCHRONIZATION',
            priority: 'secondary',
            render: (olt: any) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-2 rounded-lg font-semibold text-sm ${getSyncStatusColor(olt.syncStatus)} bg-opacity-10`}>
                    {olt.syncStatus || '0'}%
                  </div>
                  <div>
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400 text-xs">
                      <HiCheck className="w-3 h-3" />
                      <span>Completed</span>
                    </div>
                    {olt.syncDate && (
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-xs mt-1">
                        <HiOutlineCalendar className="w-3 h-3" />
                        <span>{new Date(olt.syncDate).toLocaleDateString('id-ID')}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          },
          {
            key: 'connection',
            header: 'CONNECTION',
            priority: 'tertiary',
            render: (olt: any) => (
              <div className="space-y-1">
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${olt.telnetConnected
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                >
                  Telnet {olt.telnetConnected ? 'Connected' : 'Disconnected'}
                </span>
                <br />
                <span
                  className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${olt.snmpConnected
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                    }`}
                >
                  SNMP {olt.snmpConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            )
          }
        ]}
        renderActions={(olt: any) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => handleView(olt)}
              className="p-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
              title="Lihat Data ONU"
            >
              <HiEye className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleSync(olt)}
              disabled={!olt.snmpConnected}
              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Sync Data"
            >
              <HiArrowPath className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleEdit(olt)}
              className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
              title="Edit"
            >
              <HiPencil className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleDelete(olt)}
              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
              title="Hapus OLT"
            >
              <HiTrash className="w-5 h-5" />
            </button>
          </div>
        )}
        emptyMessage="Tidak ada data OLT. Klik 'Tambah OLT' untuk menambahkan."
      />

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

      {/* View ONU Modal */}
      {isViewModalOpen && viewOlt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Data ONU - {viewOlt.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {viewOlt.ipAddress} | Total: {onuPagination?.total ?? onus.length} ONU {onuPagination && onuPagination.totalPages > 1 ? `(Halaman ${onuPagination.page}/${onuPagination.totalPages})` : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsViewModalOpen(false)
                  setViewOlt(null)
                  setOnus([])
                  setOnuPagination(null)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto px-6 py-4">
              {loadingOnus ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="mb-4 text-4xl">⏳</div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Memuat data ONU...</p>
                  </div>
                </div>
              ) : onus.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tidak ada data ONU yang tersimpan untuk OLT ini.
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                    Silakan sync data terlebih dahulu untuk melihat data ONU.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">GPON ONU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">RX OLT</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">RX ONU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">TX OLT</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">TX ONU</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Serial Number</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">PPPoE</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">MAC Address</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Last Seen</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {onus.map((onu, index) => (
                        <tr key={onu.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                          <td className="px-3 py-2 text-gray-900 dark:text-white font-mono text-xs">{onu.gponOnu || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white">{onu.name || 'N/A'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${onu.status === 'Online'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : onu.status === 'LOS'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : onu.status === 'DyingGasp'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                              }`}>
                              {onu.status || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.rxOlt || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.rxOnu || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.txOlt || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.txOnu || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{onu.serialNumber || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.actualType || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">{onu.pppoe || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 font-mono text-xs">{onu.macAddress || 'N/A'}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                            {onu.lastSeen ? new Date(onu.lastSeen).toLocaleString('id-ID') : 'N/A'}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleTestSnmpTable(onu)}
                              disabled={!onu.statusOid || !onu.compositeIndex}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!onu.statusOid || !onu.compositeIndex ? 'OID belum tersimpan, sync ONU terlebih dahulu' : 'Test SNMP TABLE'}
                            >
                              <HiOutlineTableCells className="w-3 h-3" />
                              Test Table
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan {onus.length} dari {onuPagination?.total ?? onus.length} ONU di database
                {onuPagination && onuPagination.totalPages > 1 && ` (Halaman ${onuPagination.page}/${onuPagination.totalPages})`}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/admin/network/onu?oltId=${viewOlt.id}`)}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Lihat Detail Lengkap
                </button>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false)
                    setViewOlt(null)
                    setOnus([])
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Test SNMP TABLE */}
      {testTableModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Test SNMP TABLE
                </h3>
                {selectedOnuForTest && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    ONU: {selectedOnuForTest.gponOnu} - {selectedOnuForTest.name}
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setTestTableModalOpen(false)
                  setTestTableResult(null)
                  setTestTableError(null)
                  setSelectedOnuForTest(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <HiXMark className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {testTableLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <HiArrowPath className="w-8 h-8 animate-spin text-blue-600" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Menguji SNMP TABLE...
                    </p>
                  </div>
                </div>
              ) : testTableError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-400">
                    <HiExclamationTriangle className="w-5 h-5" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                    {testTableError}
                  </p>
                </div>
              ) : testTableResult ? (
                <div className="space-y-4">
                  {/* Info */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Base OID:</span>
                        <p className="font-mono text-xs text-gray-600 dark:text-gray-400 mt-1 break-all">
                          {testTableResult.baseOid || 'N/A'}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-medium text-gray-700 dark:text-gray-300">Columns:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1 break-all">
                          {testTableResult.columns || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Composite Index:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.onu?.compositeIndex || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">ONU ID:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.onu?.onuId || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Total Results:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.totalResults || 0}
                        </p>
                      </div>
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">Raw Total Results:</span>
                        <p className="text-gray-600 dark:text-gray-400 mt-1">
                          {testTableResult.rawTotalResults || 0}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Results Table */}
                  {testTableResult.results && Object.keys(testTableResult.results).length > 0 ? (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                Key (Column.Index)
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {Object.entries(testTableResult.results).map(([key, value]) => (
                              <tr key={key} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                                <td className="px-4 py-3 text-sm font-mono text-gray-900 dark:text-white">
                                  {key}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 break-all">
                                  {String(value)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                        <HiInformationCircle className="w-5 h-5" />
                        <span className="font-medium">Tidak ada data</span>
                      </div>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                        SNMP TABLE tidak mengembalikan data untuk ONU ini.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => {
                  setTestTableModalOpen(false)
                  setTestTableResult(null)
                  setTestTableError(null)
                  setSelectedOnuForTest(null)
                }}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded hover:bg-gray-700 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
