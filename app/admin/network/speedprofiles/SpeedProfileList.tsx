"use client"

import { useEffect, useState } from 'react'
import { HiOutlineExclamationCircle, HiPencil, HiTrash } from 'react-icons/hi2'
import SpeedProfileModal from '@/components/speedprofile/SpeedProfileModal'
import PageLoader from '@/components/ui/PageLoader'
import ResponsiveTable from '@/components/ui/ResponsiveTable'

type SpeedProfile = {
  id: string
  oltId: string
  profileType: string
  name: string
  type: number
  bandwidthSir: number
  burstPir: number
  fixed: number | null
  assured: number | null
  maximum: number | null
}

type Olt = {
  id: string
  name: string
  ipAddress?: string
}

type SpeedProfileWithOlt = SpeedProfile & {
  olt: Olt
}

export default function SpeedProfilesPage() {
  const [loading, setLoading] = useState(true)
  const [speedProfiles, setSpeedProfiles] = useState<SpeedProfileWithOlt[]>([])
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [expandedOlts, setExpandedOlts] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'Download' | 'Upload'>('Download')
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [speedProfilesRes, oltsRes] = await Promise.all([
        fetch('/api/speedprofiles'),
        fetch('/api/olts'),
      ])

      if (!speedProfilesRes.ok) {
        let errorMessage = `Gagal memuat SpeedProfiles: ${speedProfilesRes.status}`
        try {
          const errorData = await speedProfilesRes.json()
          if (errorData && typeof errorData === 'object' && 'error' in errorData) {
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          errorMessage = `Gagal memuat SpeedProfiles: ${speedProfilesRes.status} ${speedProfilesRes.statusText || ''}`
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

      const speedProfilesData = await speedProfilesRes.json()
      const oltsData = await oltsRes.json()

      // Map speedProfiles dengan olt data
      const speedProfilesWithOlt: SpeedProfileWithOlt[] = (speedProfilesData.speedProfiles || []).map(
        (profile: SpeedProfile) => {
          const olt = oltsData.olts?.find((o: Olt) => o.id === profile.oltId)
          return {
            ...profile,
            olt: olt || { id: profile.oltId, name: 'Unknown' },
          }
        }
      )

      setSpeedProfiles(speedProfilesWithOlt)
      const oltList = oltsData.olts || []
      setOlts(oltList.map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress })))

      // Auto-expand semua OLT yang memiliki SpeedProfile
      const allOltIds = new Set(speedProfilesWithOlt.map((p) => p.oltId))
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
    if (!confirm('Apakah Anda yakin ingin menghapus Speed Profile ini?')) {
      return
    }

    try {
      const res = await fetch(`/api/speedprofiles/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Gagal menghapus Speed Profile')
        return
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting Speed Profile:', error)
      alert('Terjadi kesalahan saat menghapus Speed Profile')
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

  // Filter speedProfiles berdasarkan selectedOltId dan activeTab
  const filteredProfiles = speedProfiles.filter((p) => {
    const matchOlt = !selectedOltId || p.oltId === selectedOltId
    const matchTab = p.profileType === activeTab
    return matchOlt && matchTab
  })

  // Group speedProfiles by oltId
  const groupedByOlt = filteredProfiles.reduce((acc, profile) => {
    if (!acc[profile.oltId]) {
      acc[profile.oltId] = []
    }
    acc[profile.oltId]?.push(profile)
    return acc
  }, {} as Record<string, SpeedProfileWithOlt[]>)

  if (loading) {
    return <PageLoader />
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white">Speed</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Speed Profiles</h1>
      </div>

      {/* OLT Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <label className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2 block">Pilih OLT</label>
        <select
          value={selectedOltId}
          onChange={(e) => {
            const oltId = e.target.value
            setSelectedOltId(oltId)
            if (oltId) {
              setExpandedOlts(new Set([oltId]))
            } else {
              const allOltIds = new Set(speedProfiles.map((p) => p.oltId))
              setExpandedOlts(allOltIds)
            }
          }}
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
            <div className="shrink-0">
              <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-400">Error</h3>
              <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        {/* Header with Create Button */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">List Speed Profiles</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <span>+</span>
            Create
          </button>
        </div>

        {/* Info Text */}
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          The Speed Profiles added here will be applied to the OLT automatically.
        </p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('Download')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'Download'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Download
          </button>
          <button
            onClick={() => setActiveTab('Upload')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'Upload'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
          >
            Upload
          </button>
        </div>

        {/* Collapsible OLT Sections */}
        {Object.keys(groupedByOlt).length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {selectedOltId
                ? `Tidak ada data Speed Profile untuk OLT yang dipilih.`
                : 'Tidak ada data Speed Profile. Klik "Create" untuk menambahkan.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {Object.entries(groupedByOlt).map(([oltId, profiles]) => {
              const olt = profiles[0]?.olt
              const isExpanded = expandedOlts.has(oltId)

              return (
                <div
                  key={oltId}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
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
                    <ResponsiveTable
                      data={profiles}
                      columns={[
                        {
                          key: 'name',
                          header: 'Name',
                          priority: 'primary',
                          render: (profile) => (
                            <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {profile.name}
                            </span>
                          ),
                        },
                        {
                          key: 'type',
                          header: 'Type',
                          priority: 'primary',
                        },
                        {
                          key: 'fixed',
                          header: 'Fixed',
                          priority: 'secondary',
                          render: (profile) => (
                            <span className="text-sm text-gray-900 dark:text-white">
                              {profile.fixed ? `${profile.fixed} kbps` : '-'}
                            </span>
                          ),
                        },
                        {
                          key: 'assured',
                          header: 'Assured',
                          priority: 'secondary',
                          render: (profile) => (
                            <span className="text-sm text-gray-900 dark:text-white">
                              {profile.assured ? `${profile.assured} kbps` : '-'}
                            </span>
                          ),
                        },
                        {
                          key: 'maximum',
                          header: 'Maximum',
                          priority: 'secondary',
                          render: (profile) => (
                            <span className="text-sm text-gray-900 dark:text-white">
                              {profile.maximum ? `${profile.maximum} kbps` : '-'}
                            </span>
                          ),
                        },
                      ]}
                      keyField="id"
                      emptyMessage="No profiles found"
                      renderActions={(profile) => (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors"
                            title="Edit"
                          >
                            <HiPencil className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(profile.id)}
                            className="inline-flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Delete"
                          >
                            <HiTrash className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Create SpeedProfile */}
      <SpeedProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={async (data) => {
          try {
            const res = await fetch('/api/speedprofiles', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            })

            if (!res.ok) {
              const errorData = await res.json().catch(() => ({}))
              throw new Error(errorData.error || 'Gagal menyimpan Speed Profile')
            }

            await loadData()
          } catch (err: any) {
            throw err
          }
        }}
      />
    </div>
  )
}

