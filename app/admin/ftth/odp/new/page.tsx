"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/common/MapPicker').then(m => m.default), { ssr: false })
const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })
import Modal from '@/components/common/Modal'

type Odc = { id: string; name: string }
type OdcOutput = { id: string; idx: number; slotName: string }
type OutputCore = { idx: number; slotName: string; redaman: string; tubeColor: string; coreColor: string }

export default function OdpNewPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>('AKTIF')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [locLoading, setLocLoading] = useState(false)

  // INPUT: pilih ODC
  const [odcs, setOdcs] = useState<Odc[]>([])
  const [selectedOdcId, setSelectedOdcId] = useState<string>('')
  const [outputs, setOutputs] = useState<OdcOutput[]>([])
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')

  const [mapOpen, setMapOpen] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // OUTPUT section (mirip sketsa)
  const standard12Colors = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua']
  const tubeColorOptions = ['Non-tube', ...standard12Colors]
  const [jumlahCore, setJumlahCore] = useState<number>(0)
  const [outputCores, setOutputCores] = useState<OutputCore[]>([])

  // Reverse geocoding otomatis ketika koordinat diisi
  useEffect(() => {
    // Skip pada initial load
    if (isInitialLoad) {
      setIsInitialLoad(false)
      return
    }

    // Skip jika salah satu koordinat kosong
    if (!latitude || !longitude) return

    const latNum = parseFloat(latitude)
    const lonNum = parseFloat(longitude)

    // Validasi koordinat
    if (isNaN(latNum) || isNaN(lonNum)) return
    if (latNum < -90 || latNum > 90 || lonNum < -180 || lonNum > 180) return

    // Hanya update location jika masih kosong
    if (location.trim()) return

    // Debounce untuk menghindari terlalu banyak request
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`)
        if (res.ok) {
          const j = await res.json()
          if (j?.displayName) {
            setLocation(j.displayName)
          }
        }
      } catch (e) {
        // Abaikan error, user bisa isi manual
      }
    }, 1000) // Debounce 1 detik

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/odcs')
        if (!res.ok) throw new Error('Gagal memuat ODC')
        const j = await res.json()
        const rows = (j?.odcs || []).map((o: any) => ({ id: o.id, name: o.name }))
        setOdcs(rows)
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [])

  useEffect(() => {
    if (!selectedOdcId) { setOutputs([]); setSelectedOutputId(''); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/odcs/${selectedOdcId}`)
        if (!res.ok) throw new Error('Gagal memuat slot')
        const j = await res.json()
        const outs = (j?.odc?.outputs || []) as any[]
        setOutputs(outs.map((o: any) => ({ id: o.id, idx: o.idx, slotName: o.slotName })))
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [selectedOdcId])

  // Sinkronkan jumlah baris output
  useEffect(() => {
    setOutputCores((prev) => {
      if (jumlahCore <= 0) return []
      const next = [...prev]
      if (jumlahCore > next.length) {
        for (let i = next.length; i < jumlahCore; i++) {
          next.push({ idx: i, slotName: `SLOT-${i + 1}`, redaman: '', tubeColor: 'Non-tube', coreColor: standard12Colors[0] })
        }
      } else if (jumlahCore < next.length) {
        next.length = jumlahCore
      }
      return next
    })
  }, [jumlahCore])

  function handleRemoveOutput(idx: number) {
    setOutputCores((prev) => prev.filter((_, i) => i !== idx).map((o, i) => ({ ...o, idx: i })))
    setJumlahCore((prev) => Math.max(0, prev - 1))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!selectedOdcId) { setError('Pilih ODC'); return }
    if (!selectedOutputId) { setError('Pilih Slot'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/odps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          location: location || null,
          notes: notes || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          status,
          odcId: selectedOdcId,
          odcOutputId: selectedOutputId,
          outputs: outputCores.map((o, idx) => ({
            idx,
            slotName: o.slotName,
            redaman: o.redaman ? Number(o.redaman) : null,
            tubeColor: o.tubeColor,
            coreColor: o.coreColor,
          })),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Gagal menyimpan ODP')
      }
      router.push('/admin/ftth/odp')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah ODP</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Isi data ODP dan pilih input ODC.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-900 dark:text-white">Data Dasar</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama ODP</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: ODP-RT01" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: Jl. Merdeka No. 1" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Keterangan tambahan" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Latitude (opsional)</label>
                <input value={latitude} onChange={(e) => setLatitude(e.target.value)} type="number" step="any" min={-90} max={90} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: -6.200000" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Longitude (opsional)</label>
                <input value={longitude} onChange={(e) => setLongitude(e.target.value)} type="number" step="any" min={-180} max={180} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: 106.816666" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!navigator.geolocation) { setError('Browser tidak mendukung geolocation'); return }
                  setError(null)
                  setLocLoading(true)
                  navigator.geolocation.getCurrentPosition(async (pos) => {
                    try {
                      const lat = String(pos.coords.latitude); const lon = String(pos.coords.longitude)
                      setLatitude(lat); setLongitude(lon)
                      const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
                      if (res.ok) { const j = await res.json(); if (j?.displayName) setLocation(j.displayName) }
                    } finally { setLocLoading(false) }
                  }, (err) => { setError(err.message || 'Gagal mendapatkan lokasi'); setLocLoading(false) }, { enableHighAccuracy: true, timeout: 10000 })
                }}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm"
              >
                {locLoading ? 'Mengambil lokasi…' : 'Gunakan Lokasi Saya'}
              </button>
              <button type="button" onClick={() => setMapOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm">Pilih di Peta</button>
            </div>

            <Modal open={mapOpen} onClose={() => setMapOpen(false)} title="Pilih Lokasi di Peta">
              <MapPickerWithSearch
                lat={latitude ? Number(latitude) : null}
                lon={longitude ? Number(longitude) : null}
                onChange={async (la, lo) => {
                  setLatitude(String(la))
                  setLongitude(String(lo))
                  // Reverse geocoding ketika pilih di peta
                  try {
                    const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(String(la))}&lon=${encodeURIComponent(String(lo))}`)
                    if (res.ok) {
                      const j = await res.json()
                      if (j?.displayName && !location.trim()) {
                        setLocation(j.displayName)
                      }
                    }
                  } catch (e) {
                    // Abaikan error
                  }
                }}
              />
            </Modal>
          </div>
        </div>

        {/* INPUT Section */}
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-900 dark:text-white">INPUT</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih ODC</label>
              <select value={selectedOdcId} onChange={(e) => setSelectedOdcId(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih ODC --</option>
                {odcs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih Slot</label>
              <select value={selectedOutputId} onChange={(e) => setSelectedOutputId(e.target.value)} disabled={!selectedOdcId} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih Slot --</option>
                {outputs.sort((a,b)=>a.idx-b.idx).map((s)=> (
                  <option key={s.id} value={s.id}>{`SLOT-${s.idx + 1}: ${s.slotName}`}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* OUTPUT Section */}
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-900 dark:text-white">OUTPUT</h2>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Jumlah Core</label>
            <input
              type="number"
              min={0}
              step={1}
              value={jumlahCore || ''}
              onChange={(e) => {
                const v = parseInt(e.target.value || '0')
                setJumlahCore(Number.isNaN(v) ? 0 : Math.max(0, v))
              }}
              placeholder="Masukkan jumlah core"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
          {outputCores.length > 0 && (
            <div className="rounded-md border border-gray-200 dark:border-gray-800">
              <div className="grid grid-cols-12 items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                <div className="col-span-3 px-3 py-2 text-xs font-semibold">NAMA SLOT</div>
                <div className="col-span-3 px-3 py-2 text-xs font-semibold">Redaman</div>
                <div className="col-span-3 px-3 py-2 text-xs font-semibold">Tube Color</div>
                <div className="col-span-2 px-3 py-2 text-xs font-semibold">Core Color</div>
                <div className="col-span-1 px-3 py-2 text-xs font-semibold"></div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {outputCores.map((row, i) => (
                  <div key={i} className="grid grid-cols-12 items-center px-3 py-2 gap-2">
                    <div className="col-span-3">
                      <input
                        value={row.slotName}
                        onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, slotName: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                        placeholder={`SLOT-${i + 1}`}
                      />
                    </div>
                    <div className="col-span-3">
                      <input
                        type="number"
                        step="0.01"
                        value={row.redaman}
                        onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, redaman: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-3">
                      <select
                        value={row.tubeColor}
                        onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, tubeColor: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                      >
                        {tubeColorOptions.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <select
                        value={row.coreColor}
                        onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, coreColor: e.target.value } : r))}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm"
                      >
                        {standard12Colors.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveOutput(i)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        aria-label="Hapus"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                          <path d="M3 6h18"/>
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (<div className="text-sm text-red-600 dark:text-red-400">{error}</div>)}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">{loading ? 'Menyimpan...' : 'Simpan'}</button>
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Batal</button>
        </div>
      </form>
    </div>
  )
}


