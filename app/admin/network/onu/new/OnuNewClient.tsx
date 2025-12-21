"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiOutlinePlus, HiOutlineSignal, HiOutlineDevicePhoneMobile, HiArrowPath, HiArrowRightOnRectangle, HiArrowDownTray } from 'react-icons/hi2'
import PageLoader from '@/components/ui/PageLoader'

type Olt = { id: string; name: string; ipAddress: string }
type UnconfiguredOnu = {
  id: string
  model: string
  serialNumber: string
  port: string
}

export function ClientComponent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oltId = searchParams.get('oltId')

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOlt, setSelectedOlt] = useState<Olt | null>(null)
  const [unconfiguredOnus, setUnconfiguredOnus] = useState<UnconfiguredOnu[]>([])

  // Load OLTs
  useEffect(() => {
    ; (async () => {
      try {
        const res = await fetch('/api/olts')
        if (!res.ok) throw new Error('Gagal memuat data OLT')
        const j = await res.json()
        const rows = (j?.olts || []).map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress }))
        setOlts(rows)

        // Auto-select OLT jika ada oltId di URL
        if (oltId && rows.length > 0) {
          const found = rows.find((o: Olt) => o.id === oltId)
          if (found) {
            setSelectedOlt(found)
            loadUnconfiguredOnus(found.id)
          }
        }
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [oltId])

  const loadUnconfiguredOnus = async (oltIdToLoad: string) => {
    setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(`/api/olts/${oltIdToLoad}/unconfigured-onus`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Gagal memuat unconfigured ONU' }))
        const errorMessage = errorData.error || 'Gagal memuat unconfigured ONU'
        throw new Error(errorMessage)
      }
      const data = await res.json()
      setUnconfiguredOnus(data.unconfiguredOnus || [])

      // Jika tidak ada ONU, tampilkan pesan info
      if (data.unconfiguredOnus && data.unconfiguredOnus.length === 0) {
        setError(null) // Clear error jika memang tidak ada data
      }
    } catch (e: any) {
      setError(e.message)
      setUnconfiguredOnus([])
    } finally {
      setRefreshing(false)
    }
  }

  const handleOltChange = (oltId: string) => {
    const olt = olts.find((o) => o.id === oltId)
    if (olt) {
      setSelectedOlt(olt)
      loadUnconfiguredOnus(olt.id)
    } else {
      setSelectedOlt(null)
      setUnconfiguredOnus([])
    }
  }

  const handleRefresh = () => {
    if (selectedOlt) {
      loadUnconfiguredOnus(selectedOlt.id)
    }
  }

  const handleRegister = (onu: UnconfiguredOnu) => {
    if (!selectedOlt) return

    // Redirect ke halaman register dengan parameter
    router.push(
      `/admin/network/onu/register?oltId=${selectedOlt.id}&serialNumber=${encodeURIComponent(onu.serialNumber)}&port=${encodeURIComponent(onu.port)}`
    )
  }

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span> <span className="text-gray-900 dark:text-white">Add-ONU</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add-ONU</h1>
      </div>

      {/* OLT Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">Pilih OLT</label>
        <select
          value={selectedOlt?.id || ''}
          onChange={(e) => handleOltChange(e.target.value)}
          className="w-full max-w-md rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
        >
          <option value="">-- Pilih OLT --</option>
          {olts.map((olt) => (
            <option key={olt.id} value={olt.id}>
              {olt.name} ({olt.ipAddress})
            </option>
          ))}
        </select>
      </div>

      {/* Unconfigured ONU Section */}
      {selectedOlt && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Unconfigured ONU</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
              >
                <HiArrowPath className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => {
                  // TODO: Implementasi form untuk add ONU manual
                  alert('Fitur Add ONU manual sedang dalam pengembangan')
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <HiOutlinePlus className="w-4 h-4" />
                Add ONU
              </button>
            </div>
          </div>

          {/* OLT Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <HiOutlineSignal className="text-2xl" />
              </div>
              <div>
                <div className="text-base font-semibold text-gray-900 dark:text-white">{selectedOlt.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{selectedOlt.ipAddress}</div>
              </div>
            </div>
          </div>

          {/* Unconfigured ONU List */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {!error && unconfiguredOnus.length === 0 && !refreshing && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">Tidak ada unconfigured ONU ditemukan</p>
            </div>
          )}

          {unconfiguredOnus.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="relative pl-8">
                {/* Vertical dashed line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 border-l-2 border-dashed border-gray-300 dark:border-gray-600"></div>

                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {unconfiguredOnus.map((onu, index) => (
                    <div key={onu.id} className="relative flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                      {/* Number and icon */}
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            {index + 1}
                          </div>
                          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                            <HiOutlineDevicePhoneMobile className="text-xl" />
                          </div>
                        </div>

                        {/* ONU Info */}
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{onu.model}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{onu.serialNumber}</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors"
                        >
                          <HiArrowRightOnRectangle className="w-4 h-4" />
                          Port {onu.port}
                        </button>
                        <button
                          onClick={() => handleRegister(onu)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          <HiArrowDownTray className="w-4 h-4" />
                          Register
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedOlt && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Pilih OLT terlebih dahulu untuk melihat unconfigured ONU</p>
        </div>
      )}
    </div>
  )
}

