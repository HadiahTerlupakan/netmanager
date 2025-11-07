"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const MapPicker = dynamic(() => import('@/components/common/MapPicker').then(m => m.default), { ssr: false })
const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })
import Modal from '@/components/common/Modal'

type Otb = { id: string; name: string }
type OtbCore = { id: string; idx: number; slotName: string; tubeColor: string; coreColor: string }

type OutputCore = {
  idx: number
  slotName: string
  redaman: string
  tubeColor: string
  coreColor: string
}

const standard12Colors = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua']
const tubeColorOptions = ['Non-tube', ...standard12Colors]

async function fetchDetail(id: string) {
  const res = await fetch(`/api/odcs/${id}`)
  if (!res.ok) throw new Error('Gagal memuat data')
  const j = await res.json()
  return j.odc
}

export default function OdcEditPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [locLoading, setLocLoading] = useState(false)

  // INPUT Section
  const [otbs, setOtbs] = useState<Otb[]>([])
  const [selectedOtbId, setSelectedOtbId] = useState<string>('')
  const [slots, setSlots] = useState<OtbCore[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string>('')
  const [jumlahCore, setJumlahCore] = useState<number>(0)

  // OUTPUT Section
  const [outputCores, setOutputCores] = useState<OutputCore[]>([])

  const [mapOpen, setMapOpen] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasLoadedData, setHasLoadedData] = useState(false)

  // Reverse geocoding otomatis ketika koordinat diisi
  useEffect(() => {
    // Skip pada initial load atau saat data pertama kali dimuat
    if (isInitialLoad || !hasLoadedData) return

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
  }, [latitude, longitude, hasLoadedData])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/otbs')
        if (res.ok) {
          const j = await res.json()
          setOtbs((j?.otbs || []).map((o: any) => ({ id: o.id, name: o.name })))
        }
      } catch {}
    })()
  }, [])

  useEffect(() => {
    if (!params?.id) return
    ;(async () => {
      try {
        const d = await fetchDetail(params.id as string)
        setName(d.name || '')
        setLocation(d.location || '')
        setNotes(d.notes || '')
        setLatitude(d.latitude != null ? String(d.latitude) : '')
        setLongitude(d.longitude != null ? String(d.longitude) : '')
        // Muat detail relasi slot dan OTB
        if (d.otbCoreId && d.otbCore?.otb?.id) {
          setSelectedOtbId(d.otbCore.otb.id)
          setSelectedSlotId(d.otbCoreId)
        }
        // Muat output cores
        if (d.outputs && Array.isArray(d.outputs)) {
          const outputs = d.outputs.map((o: any) => ({
            idx: o.idx,
            slotName: o.slotName || '',
            redaman: o.redaman != null ? String(o.redaman) : '',
            tubeColor: o.tubeColor || 'Non-tube',
            coreColor: o.coreColor || standard12Colors[0],
          }))
          setOutputCores(outputs)
          setJumlahCore(outputs.length)
        }
        setHasLoadedData(true)
        setIsInitialLoad(false)
      } catch (e: any) {
        setError(e.message)
        setHasLoadedData(true)
        setIsInitialLoad(false)
      } finally {
        setLoading(false)
      }
    })()
  }, [params])

  // Saat OTB dipilih, muat slots
  useEffect(() => {
    if (!selectedOtbId) { setSlots([]); return }
    ;(async () => {
      try {
        const res = await fetch(`/api/otbs/${selectedOtbId}`)
        if (!res.ok) throw new Error('Gagal memuat slot OTB')
        const j = await res.json()
        const cores = (j?.otb?.cores || []) as any[]
        setSlots(cores.map((c: any) => ({ id: c.id, idx: c.idx, slotName: c.slotName, tubeColor: c.tubeColor || '', coreColor: c.coreColor || '' })))
      } catch (e: any) {
        setError(e.message)
      }
    })()
  }, [selectedOtbId])

  // Sinkronkan jumlah baris output cores dengan jumlahCore
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
    if (!selectedSlotId) { setError('Pilih slot OTB'); return }
    if (outputCores.length === 0) { setError('Minimal 1 output core'); return }
    const res = await fetch(`/api/odcs/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        location: location || null,
        notes: notes || null,
        latitude: latitude ? Number(latitude) : null,
        longitude: longitude ? Number(longitude) : null,
        otbCoreId: selectedSlotId,
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
      setError(j?.error || 'Gagal menyimpan')
      return
    }
    router.push('/admin/ftth/odc')
    router.refresh()
  }

  if (loading) return <div className="text-sm text-gray-500">Memuat...</div>
  if (error && !name) return <div className="text-sm text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit ODC</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
        {/* Data Dasar ODC */}
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-900 dark:text-white">Data Dasar</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama ODC</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Latitude (opsional)</label>
                <input value={latitude} onChange={(e) => setLatitude(e.target.value)} type="number" step="any" min={-90} max={90} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Longitude (opsional)</label>
                <input value={longitude} onChange={(e) => setLongitude(e.target.value)} type="number" step="any" min={-180} max={180} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => {
                if (!navigator.geolocation) { setError('Browser tidak mendukung geolocation'); return }
                setError(null); setLocLoading(true)
                navigator.geolocation.getCurrentPosition(async (pos) => {
                  try {
                    const lat = String(pos.coords.latitude); const lon = String(pos.coords.longitude)
                    setLatitude(lat); setLongitude(lon)
                    const res = await fetch(`/api/geocode/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`)
                    if (res.ok) { const j = await res.json(); if (j?.displayName) setLocation(j.displayName) }
                  } finally { setLocLoading(false) }
                }, (err) => { setError(err.message || 'Gagal mendapatkan lokasi'); setLocLoading(false) }, { enableHighAccuracy: true, timeout: 10000 })
              }} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm">{locLoading ? 'Mengambil lokasi…' : 'Gunakan Lokasi Saya'}</button>
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
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih OTB</label>
              <select value={selectedOtbId} onChange={(e) => setSelectedOtbId(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih OTB --</option>
                {otbs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih Slot</label>
              <select value={selectedSlotId} onChange={(e) => setSelectedSlotId(e.target.value)} disabled={!selectedOtbId} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih Slot --</option>
                {slots.sort((a, b) => a.idx - b.idx).map((s) => (
                  <option key={s.id} value={s.id}>
                    {`SLOT-${s.idx + 1}: ${s.slotName} — ${s.tubeColor || 'Non-tube'} / ${s.coreColor || '-'}`}
                  </option>
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
          <button type="submit" className="inline-flex items-center gap-2 rounded-md bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700">Simpan</button>
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-md border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm">Batal</button>
        </div>
      </form>
    </div>
  )
}
