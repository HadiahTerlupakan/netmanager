"use client"

import { useEffect, useState } from 'react'
import { HiXMark, HiCheck } from 'react-icons/hi2'

type Olt = {
  id: string
  name: string
  ipAddress?: string
}

interface OnuTypeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    oltId: string
    name: string
    ethernetPorts: number
    wifi: number
    voipPorts: number
  }) => Promise<void>
}

export default function OnuTypeModal({ isOpen, onClose, onSubmit }: OnuTypeModalProps) {
  const [olts, setOlts] = useState<Olt[]>([])
  const [loadingOlts, setLoadingOlts] = useState(true)
  const [selectedOltId, setSelectedOltId] = useState<string>('')
  const [name, setName] = useState('')
  const [ethernetEnabled, setEthernetEnabled] = useState(false)
  const [ethernetPorts, setEthernetPorts] = useState<number>(0)
  const [wifiEnabled, setWifiEnabled] = useState(false)
  const [wifi, setWifi] = useState<number>(0)
  const [voipEnabled, setVoipEnabled] = useState(false)
  const [voipPorts, setVoipPorts] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadOlts()
    } else {
      // Reset form when modal closes
      setSelectedOltId('')
      setName('')
      setEthernetEnabled(false)
      setEthernetPorts(0)
      setWifiEnabled(false)
      setWifi(0)
      setVoipEnabled(false)
      setVoipPorts(0)
      setError(null)
    }
  }, [isOpen])

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedOltId) {
      setError('Pilih OLT terlebih dahulu')
      return
    }

    if (!name.trim()) {
      setError('Nama ONU Type harus diisi')
      return
    }

    setLoading(true)
    try {
      await onSubmit({
        oltId: selectedOltId,
        name: name.trim(),
        ethernetPorts: ethernetEnabled ? ethernetPorts : 0,
        wifi: wifiEnabled ? wifi : 0,
        voipPorts: voipEnabled ? voipPorts : 0,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan OnuType')
    } finally {
      setLoading(false)
    }
  }

  // Generate options for ports/SSIDs (0-10)
  const portOptions = Array.from({ length: 11 }, (_, i) => i)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Onu Type</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <HiXMark className="text-2xl" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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

          {/* ONU Type Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ONU type
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              placeholder="Contoh: ZTE, H640GW, HG8245H"
            />
          </div>

          {/* Ethernet Ports */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Ethernet Ports
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ethernetEnabled}
                  onChange={(e) => {
                    setEthernetEnabled(e.target.checked)
                    if (!e.target.checked) {
                      setEthernetPorts(0)
                    }
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
              </label>
            </div>
            <select
              value={ethernetPorts}
              onChange={(e) => setEthernetPorts(parseInt(e.target.value) || 0)}
              disabled={!ethernetEnabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="0">Select Ports</option>
              {portOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          {/* WiFi SSIDs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                WiFi SSIDs
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wifiEnabled}
                  onChange={(e) => {
                    setWifiEnabled(e.target.checked)
                    if (!e.target.checked) {
                      setWifi(0)
                    }
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
              </label>
            </div>
            <select
              value={wifi}
              onChange={(e) => setWifi(parseInt(e.target.value) || 0)}
              disabled={!wifiEnabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="0">Select SSIDs</option>
              {portOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

          {/* VoIP Ports */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                VoIP Ports
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voipEnabled}
                  onChange={(e) => {
                    setVoipEnabled(e.target.checked)
                    if (!e.target.checked) {
                      setVoipPorts(0)
                    }
                  }}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">Enable</span>
              </label>
            </div>
            <select
              value={voipPorts}
              onChange={(e) => setVoipPorts(parseInt(e.target.value) || 0)}
              disabled={!voipEnabled}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed"
            >
              <option value="0">Select Ports</option>
              {portOptions.map((num) => (
                <option key={num} value={num}>
                  {num}
                </option>
              ))}
            </select>
          </div>

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
              <HiXMark className="w-4 h-4" />
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
            >
              <HiCheck className="w-4 h-4" />
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

