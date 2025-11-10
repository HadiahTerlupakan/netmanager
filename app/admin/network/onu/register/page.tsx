"use client"

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { HiArrowDownTray } from 'react-icons/hi2'

type Olt = { id: string; name: string; ipAddress: string }
type OnuType = { value: string; label: string }
type Vlan = { id: string; name: string; vlanId: number }
type Profile = { id: string; name: string }

export default function RegisterOnuPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oltId = searchParams.get('oltId')
  const serialNumber = searchParams.get('serialNumber')
  const port = searchParams.get('port')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [olts, setOlts] = useState<Olt[]>([])
  const [selectedOltId, setSelectedOltId] = useState<string>(oltId || '')
  const [selectedOlt, setSelectedOlt] = useState<Olt | null>(null)

  // Form fields
  const [card, setCard] = useState<string>('')
  const [portValue, setPortValue] = useState<string>(port || '')
  const [onuIdMode, setOnuIdMode] = useState<'automatic' | 'manual'>('automatic')
  const [onuIdManual, setOnuIdManual] = useState<string>('')
  const [onuSerialNumber, setOnuSerialNumber] = useState<string>(serialNumber || '')
  const [onuType, setOnuType] = useState<string>('')
  const [enableName, setEnableName] = useState<boolean>(true)
  const [enableDescription, setEnableDescription] = useState<boolean>(false)
  const [onuName, setOnuName] = useState<string>('')
  const [onuDescription, setOnuDescription] = useState<string>('')
  const [enableService1, setEnableService1] = useState<boolean>(true)
  const [service1Vlan, setService1Vlan] = useState<string>('')
  const [service1Download, setService1Download] = useState<string>('')
  const [service1Upload, setService1Upload] = useState<string>('')
  const [service1Mode, setService1Mode] = useState<'pppoe-nat' | 'wan-ip' | 'onu-webpage'>('pppoe-nat')
  const [pppoeUsername, setPppoeUsername] = useState<string>('')
  const [pppoePassword, setPppoePassword] = useState<string>('')
  const [enableService2, setEnableService2] = useState<boolean>(false)
  const [enableService3, setEnableService3] = useState<boolean>(false)

  // Data untuk dropdown
  const [onuTypes, setOnuTypes] = useState<OnuType[]>([])
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  // Load OLTs
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/olts')
        if (!res.ok) throw new Error('Gagal memuat data OLT')
        const j = await res.json()
        const rows = (j?.olts || []).map((o: any) => ({ id: o.id, name: o.name, ipAddress: o.ipAddress }))
        setOlts(rows)

        if (oltId && rows.length > 0) {
          const found = rows.find((o: Olt) => o.id === oltId)
          if (found) {
            setSelectedOlt(found)
            setSelectedOltId(found.id)
          }
        }
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [oltId])

  // Parse port untuk mendapatkan card dan port
  useEffect(() => {
    if (port && !card && !portValue) {
      // Format: 1/3/1 -> card: 1, port: 3, onuId: 1
      const parts = port.split('/')
      if (parts.length >= 2) {
        setCard(parts[0] || '')
        setPortValue(parts[1] || '')
        // Jika ada ONU ID di bagian ketiga, simpan untuk referensi
        if (parts.length >= 3) {
          // Bisa digunakan sebagai default jika mode manual dipilih
          setOnuIdManual(parts[2] || '')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port])

  // Load ONU types, VLANs, Profiles (mock data untuk sekarang)
  useEffect(() => {
    // TODO: Load dari API
    setOnuTypes([
      { value: 'zte-f660', label: 'ZTE F660' },
      { value: 'zte-f609', label: 'ZTE F609' },
      { value: 'huawei-hg8245', label: 'Huawei HG8245' },
      { value: 'huawei-hg8145', label: 'Huawei HG8145' },
      { value: 'huawei-hg6243', label: 'Huawei HG6243' },
      { value: 'huawei-hg6145', label: 'Huawei HG6145' },
    ])

    setVlans([
      { id: '1', name: 'VLAN 100', vlanId: 100 },
      { id: '2', name: 'VLAN 200', vlanId: 200 },
      { id: '3', name: 'VLAN 300', vlanId: 300 },
    ])

    setProfiles([
      { id: '1', name: 'Profile 10M/5M' },
      { id: '2', name: 'Profile 20M/10M' },
      { id: '3', name: 'Profile 50M/25M' },
      { id: '4', name: 'Profile 100M/50M' },
    ])
  }, [])

  const handleOltChange = (oltId: string) => {
    const olt = olts.find((o) => o.id === oltId)
    if (olt) {
      setSelectedOlt(olt)
      setSelectedOltId(olt.id)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedOltId) {
      setError('Pilih OLT terlebih dahulu')
      return
    }

    if (!card || !portValue) {
      setError('Card dan Port wajib diisi')
      return
    }

    if (!onuSerialNumber) {
      setError('Serial Number wajib diisi')
      return
    }

    if (!onuType) {
      setError('ONU Type wajib dipilih')
      return
    }

    if (enableService1 && !service1Vlan) {
      setError('VLAN untuk Service 1 wajib dipilih')
      return
    }

    setLoading(true)
    try {
      // TODO: Implementasi API untuk register ONU
      // const res = await fetch('/api/onus/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     oltId: selectedOltId,
      //     card,
      //     port: portValue,
      //     onuId: onuIdMode === 'automatic' ? null : onuIdManual,
      //     serialNumber: onuSerialNumber,
      //     onuType,
      //     name: enableName ? onuName : null,
      //     description: enableDescription ? onuDescription : null,
      //     services: {
      //       service1: enableService1 ? {
      //         vlan: service1Vlan,
      //         download: service1Download,
      //         upload: service1Upload,
      //         mode: service1Mode,
      //         pppoeUsername,
      //         pppoePassword,
      //       } : null,
      //       service2: enableService2 ? {} : null,
      //       service3: enableService3 ? {} : null,
      //     },
      //   }),
      // })
      // if (!res.ok) {
      //   const j = await res.json().catch(() => ({}))
      //   throw new Error(j?.error || 'Gagal register ONU')
      // }
      // router.push('/admin/network/onu/new?oltId=' + selectedOltId)

      alert('Fitur register ONU sedang dalam pengembangan')
      console.log('Register data:', {
        oltId: selectedOltId,
        card,
        port: portValue,
        onuId: onuIdMode === 'automatic' ? 'automatic' : onuIdManual,
        serialNumber: onuSerialNumber,
        onuType,
        name: enableName ? onuName : null,
        description: enableDescription ? onuDescription : null,
        services: {
          service1: enableService1 ? {
            vlan: service1Vlan,
            download: service1Download,
            upload: service1Upload,
            mode: service1Mode,
            pppoeUsername,
            pppoePassword,
          } : null,
        },
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        <span>Home</span> <span className="mx-2">/</span> <span>Onu</span> <span className="mx-2">/</span>{' '}
        <span className="text-gray-900 dark:text-white">Register</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Register</h1>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60"
        >
          <HiArrowDownTray className="w-4 h-4" />
          Save Config
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* OLT Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">OLT (Optical Line Terminal)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">OLT</label>
              <select
                value={selectedOltId}
                onChange={(e) => handleOltChange(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="">-- Pilih OLT --</option>
                {olts.map((olt) => (
                  <option key={olt.id} value={olt.id}>
                    {olt.name} - {olt.ipAddress}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Card</label>
              <input
                type="number"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                required
                min="1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="3"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Port</label>
              <input
                type="number"
                value={portValue}
                onChange={(e) => setPortValue(e.target.value)}
                required
                min="1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="1"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">ONU ID</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="onuIdMode"
                    value="automatic"
                    checked={onuIdMode === 'automatic'}
                    onChange={(e) => setOnuIdMode(e.target.value as 'automatic' | 'manual')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Automatic</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="onuIdMode"
                    value="manual"
                    checked={onuIdMode === 'manual'}
                    onChange={(e) => setOnuIdMode(e.target.value as 'automatic' | 'manual')}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Manually</span>
                </label>
              </div>
              {onuIdMode === 'manual' && (
                <input
                  type="number"
                  value={onuIdManual}
                  onChange={(e) => setOnuIdManual(e.target.value)}
                  min="1"
                  className="w-full mt-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="Masukkan ONU ID"
                />
              )}
            </div>
          </div>
        </div>

        {/* ONU Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Onu (Optical Network Unit)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Serial Number (SN) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={onuSerialNumber}
                onChange={(e) => setOnuSerialNumber(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                placeholder="RTEGC6099704"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                ONU Type <span className="text-red-500">*</span>
              </label>
              <select
                value={onuType}
                onChange={(e) => setOnuType(e.target.value)}
                required
                className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
              >
                <option value="">Select Type</option>
                {onuTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Information Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableName}
                  onChange={(e) => setEnableName(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Name</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableDescription}
                  onChange={(e) => setEnableDescription(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Description</span>
              </label>
            </div>

            {enableName && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Name</label>
                <input
                  type="text"
                  value={onuName}
                  onChange={(e) => setOnuName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="Masukkan nama ONU"
                />
              </div>
            )}

            {enableDescription && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Description</label>
                <textarea
                  value={onuDescription}
                  onChange={(e) => setOnuDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  placeholder="Masukkan deskripsi"
                />
              </div>
            )}
          </div>
        </div>

        {/* VLAN Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Vlan (Virtual Local Area Network)</h2>
          <div className="space-y-6">
            {/* Service 1 - PPPOE */}
            <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableService1}
                  onChange={(e) => setEnableService1(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Service 1 - PPPOE</span>
              </label>

              {enableService1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Select Vlan</label>
                    <select
                      value={service1Vlan}
                      onChange={(e) => setService1Vlan(e.target.value)}
                      required={enableService1}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="">Select Vlan</option>
                      {vlans.map((vlan) => (
                        <option key={vlan.id} value={vlan.id}>
                          {vlan.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Download</label>
                    <select
                      value={service1Download}
                      onChange={(e) => setService1Download(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="">Select Profile</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Upload</label>
                    <select
                      value={service1Upload}
                      onChange={(e) => setService1Upload(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                    >
                      <option value="">Select Profile</option>
                      {profiles.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Mode</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="service1Mode"
                          value="pppoe-nat"
                          checked={service1Mode === 'pppoe-nat'}
                          onChange={(e) => setService1Mode(e.target.value as any)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">PPPOE NAT</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="service1Mode"
                          value="wan-ip"
                          checked={service1Mode === 'wan-ip'}
                          onChange={(e) => setService1Mode(e.target.value as any)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Wan-IP PPPOE</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="service1Mode"
                          value="onu-webpage"
                          checked={service1Mode === 'onu-webpage'}
                          onChange={(e) => setService1Mode(e.target.value as any)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">Setup via ONU webpage</span>
                      </label>
                    </div>
                  </div>

                  {(service1Mode === 'pppoe-nat' || service1Mode === 'wan-ip') && (
                    <>
                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-200">PPPOE Username</label>
                        <input
                          type="text"
                          value={pppoeUsername}
                          onChange={(e) => setPppoeUsername(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          placeholder="Masukkan username"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-800 dark:text-gray-200">PPPOE Password</label>
                        <input
                          type="password"
                          value={pppoePassword}
                          onChange={(e) => setPppoePassword(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          placeholder="Masukkan password"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Service 2 */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableService2}
                  onChange={(e) => setEnableService2(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Service 2</span>
              </label>
            </div>

            {/* Service 3 */}
            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enableService3}
                  onChange={(e) => setEnableService3(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Service 3</span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </form>
    </div>
  )
}

