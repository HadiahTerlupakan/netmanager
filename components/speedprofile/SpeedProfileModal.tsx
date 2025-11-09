"use client"

import { useEffect, useState } from 'react'

type Olt = {
  id: string
  name: string
  ipAddress?: string
}

interface SpeedProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    oltId: string
    profileType: string
    name: string
    type: number
    bandwidthSir: number
    burstPir: number
    fixed?: number | null
    assured?: number | null
    maximum?: number | null
  }) => Promise<void>
}

const TYPE_OPTIONS = [
  { value: 1, label: '1 - Fixed bandwidth' },
  { value: 2, label: '2 - Assured bandwidth' },
  { value: 3, label: '3 - Assured bandwidth and non-assured bandwidth' },
  { value: 4, label: '4 - Best-effort bandwidth' },
  { value: 5, label: '5 - The super set of all of T-CONT types' },
]

export default function SpeedProfileModal({ isOpen, onClose, onSubmit }: SpeedProfileModalProps) {
  const [olts, setOlts] = useState<Olt[]>([])
  const [loadingOlts, setLoadingOlts] = useState(true)
  const [profileType, setProfileType] = useState<'Download' | 'Upload'>('Download')
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [name, setName] = useState('')
  const [type, setType] = useState<number>(0)
  const [bandwidthSir, setBandwidthSir] = useState<number>(0)
  const [burstPir, setBurstPir] = useState<number>(0)
  const [fixed, setFixed] = useState<number | null>(null)
  const [assured, setAssured] = useState<number | null>(null)
  const [maximum, setMaximum] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadOlts()
    } else {
      // Reset form when modal closes
      setProfileType('Download')
      setSelectedOltId('')
      setName('')
      setType(0)
      setBandwidthSir(0)
      setBurstPir(0)
      setFixed(null)
      setAssured(null)
      setMaximum(null)
      setError(null)
    }
  }, [isOpen])

  // Update fields berdasarkan type yang dipilih (hanya untuk Download)
  useEffect(() => {
    if (profileType === 'Download') {
      if (type === 1) {
        // Fixed bandwidth
        setFixed(bandwidthSir)
        setAssured(null)
        setMaximum(null)
      } else if (type === 2) {
        // Assured bandwidth
        setFixed(null)
        setAssured(bandwidthSir)
        setMaximum(burstPir)
      } else if (type === 3) {
        // Assured bandwidth and non-assured bandwidth
        setFixed(null)
        setAssured(bandwidthSir)
        setMaximum(burstPir)
      } else if (type === 4) {
        // Best-effort bandwidth
        setFixed(null)
        setAssured(null)
        setMaximum(burstPir)
      } else if (type === 5) {
        // The super set of all of T-CONT types
        setFixed(bandwidthSir)
        setAssured(bandwidthSir)
        setMaximum(burstPir)
      } else {
        setFixed(null)
        setAssured(null)
        setMaximum(null)
      }
    } else {
      // Untuk Upload, reset semua field
      setFixed(null)
      setAssured(null)
      setMaximum(null)
    }
  }, [type, bandwidthSir, burstPir, profileType])

  const loadOlts = async () => {
    try {
      setLoadingOlts(true)
      setError(null)
      const res = await fetch('/api/olts')
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Gagal memuat data OLT')
      }
      const data = await res.json()
      const oltList = data.olts || []
      setOlts(oltList.map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress })))
    } catch (e: any) {
      console.error('Error loading OLTs:', e)
      setError(e.message || 'Gagal memuat data OLT')
    } finally {
      setLoadingOlts(false)
    }
  }

  const formatKbpsToMbps = (kbps: number) => {
    return (kbps / 1000).toFixed(2) + ' Mbps'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedOltId) {
      setError('Pilih OLT terlebih dahulu')
      return
    }

    if (!name.trim()) {
      setError('Nama Speed Profile harus diisi')
      return
    }

    if (!type || type < 1 || type > 5) {
      setError('Pilih Type terlebih dahulu')
      return
    }

    // Validasi Bandwidth dan Burst hanya untuk Download
    if (profileType === 'Download') {
      if (bandwidthSir < 0) {
        setError('Bandwidth SIR harus >= 0')
        return
      }

      if (burstPir < 0) {
        setError('Burst PIR harus >= 0')
        return
      }
    } else {
      // Untuk Upload, set default values
      if (bandwidthSir === 0) setBandwidthSir(0)
      if (burstPir === 0) setBurstPir(0)
    }

    setLoading(true)
    try {
      await onSubmit({
        oltId: selectedOltId,
        profileType,
        name: name.trim(),
        type,
        bandwidthSir,
        burstPir,
        fixed,
        assured,
        maximum,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan Speed Profile')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Speed Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Profile Type Radio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Profile
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="profileType"
                  value="Download"
                  checked={profileType === 'Download'}
                  onChange={(e) => setProfileType(e.target.value as 'Download' | 'Upload')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Download</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="profileType"
                  value="Upload"
                  checked={profileType === 'Upload'}
                  onChange={(e) => setProfileType(e.target.value as 'Download' | 'Upload')}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Upload</span>
              </label>
            </div>
          </div>

          {/* OLT Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              OLT
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">List</p>
            {loadingOlts ? (
              <div className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                Memuat data OLT...
              </div>
            ) : (
              <select
                value={selectedOltId}
                onChange={(e) => setSelectedOltId(e.target.value)}
                required
                disabled={olts.length === 0}
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
              >
                <option value="">Select OLT</option>
                {olts.map((olt) => (
                  <option key={olt.id} value={olt.id}>
                    {olt.name} {olt.ipAddress ? `(${olt.ipAddress})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: 1G, 10Mbps, 20Mbps"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(parseInt(e.target.value) || 0)}
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            >
              <option value="0">Select Type</option>
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Bandwidth (SIR) dan Burst (PIR) - hanya untuk Download */}
          {profileType === 'Download' && (
            <>
              {/* Bandwidth (SIR) - kbps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bandwidth (SIR) - kbps
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={bandwidthSir}
                    onChange={(e) => setBandwidthSir(parseInt(e.target.value) || 0)}
                    required
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    onClick={() => {
                      // Preview functionality - bisa ditambahkan logic preview nanti
                    }}
                  >
                    Preview
                  </button>
                  <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-right">
                    {formatKbpsToMbps(bandwidthSir)}
                  </div>
                </div>
              </div>

              {/* Burst (PIR) - kbps */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Burst (PIR) - kbps
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={burstPir}
                    onChange={(e) => setBurstPir(parseInt(e.target.value) || 0)}
                    required
                    className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    placeholder="0"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
                    onClick={() => {
                      // Preview functionality - bisa ditambahkan logic preview nanti
                    }}
                  >
                    Preview
                  </button>
                  <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-right">
                    {formatKbpsToMbps(burstPir)}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
              {error}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <span>×</span>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
