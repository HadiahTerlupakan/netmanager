"use client"

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { HiTrash } from 'react-icons/hi2'
import ImageUpload from '@/components/common/ImageUpload'

const MapPicker = dynamic(() => import('@/components/common/MapPicker').then(m => m.default), { ssr: false })
const MapPickerWithSearch = dynamic(() => import('@/components/common/MapPicker').then(m => m.MapPickerWithSearch), { ssr: false })
import Modal from '@/components/common/Modal'

type Odc = { id: string; name: string }
type OdcOutput = { id: string; idx: number; slotName: string }
type OutputCore = { idx: number; slotName: string; redaman: string; tubeColor: string; coreColor: string }

async function fetchDetail(id: string) {
  const res = await fetch(`/api/odps/${id}`)
  if (!res.ok) throw new Error('Gagal memuat data')
  const j = await res.json()
  return j.odp
}

// Module-level constants to avoid re-creating on every render
const STANDARD_12_COLORS = ['Biru', 'Oranye', 'Hijau', 'Coklat', 'Slate', 'Putih', 'Merah', 'Hitam', 'Kuning', 'Ungu', 'Rose', 'Aqua'] as const
const TUBE_COLOR_OPTIONS = ['Non-tube', ...STANDARD_12_COLORS] as const

export function ClientComponent() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [keteranganJumlahKabelFeeder, setKeteranganJumlahKabelFeeder] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [status, setStatus] = useState<'AKTIF' | 'NONAKTIF' | 'MAINTENANCE'>('AKTIF')
  const [locLoading, setLocLoading] = useState(false)

  const [odcs, setOdcs] = useState<Odc[]>([])
  const [selectedOdcId, setSelectedOdcId] = useState<string>('')
  const [outputs, setOutputs] = useState<OdcOutput[]>([])
  const [selectedOutputId, setSelectedOutputId] = useState<string>('')
  const [sites, setSites] = useState<{ id: string, name: string }[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>('')

  const [mapOpen, setMapOpen] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasLoadedData, setHasLoadedData] = useState(false)
  const [jumlahCore, setJumlahCore] = useState<number>(0)
  const [outputCores, setOutputCores] = useState<OutputCore[]>([])

  // ... (existing coordinates effect)

  useEffect(() => {
    ; (async () => {
      try {
        const [resOdcs, resSites] = await Promise.all([
          fetch('/api/odcs'),
          fetch('/api/admin/options')
        ])

        if (resOdcs.ok) {
          const j = await resOdcs.json()
          setOdcs((j?.odcs || []).map((o: any) => ({ id: o.id, name: o.name })))
        }

        if (resSites.ok) {
          const j = await resSites.json()
          if (j?.sites) setSites(j.sites)
        }
      } catch { }
    })()
  }, [])

  useEffect(() => {
    if (!params?.id) return
      ; (async () => {
        try {
          const d = await fetchDetail(params.id as string)
          setName(d.name || '')
          setImages(d.images || [])
          setLocation(d.location || '')
          setNotes(d.notes || '')
          setKeteranganJumlahKabelFeeder(d.keteranganJumlahKabelFeeder || '')
          setLatitude(d.latitude != null ? String(d.latitude) : '')
          setLongitude(d.longitude != null ? String(d.longitude) : '')
          setStatus(d.status || 'AKTIF')
          if (d.siteId) setSelectedSiteId(d.siteId)
          // Relasi input: odcOutput -> odc
          if (d.odcOutputId && d.odcOutput?.odc?.id) {
            setSelectedOdcId(d.odcOutput.odc.id)
            setSelectedOutputId(d.odcOutputId)
          }
          // Handle both odpOutput (Prisma) and outputs (Legacy/Mapped)
          const rawOutputs = d.odpOutput || d.outputs;
          if (rawOutputs && Array.isArray(rawOutputs)) {
            const outs = rawOutputs.map((o: any) => ({
              idx: o.idx,
              slotName: o.slotName || '',
              redaman: o.redaman != null ? String(o.redaman) : '',
              tubeColor: o.tubeColor || 'Non-tube',
              coreColor: o.coreColor || STANDARD_12_COLORS[0],
            }))
            setOutputCores(outs)
            setJumlahCore(outs.length)
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

  // ... (existing outputs fetching)

  // Sinkronkan jumlah baris output
  useEffect(() => {
    setOutputCores((prev) => {
      if (jumlahCore <= 0) return []
      const next = [...prev]
      if (jumlahCore > next.length) {
        for (let i = next.length; i < jumlahCore; i++) {
          next.push({
            idx: i,
            slotName: `SLOT-${i + 1}`,
            redaman: '',
            tubeColor: 'Non-tube',
            coreColor: STANDARD_12_COLORS[0]
          })
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
    setLoading(true)

    try {
      const res = await fetch(`/api/odps/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          images: images,
          location: location || null,
          notes: notes || null,
          keteranganJumlahKabelFeeder: keteranganJumlahKabelFeeder || null,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          status,
          odcId: selectedOdcId || null,
          odcOutputId: selectedOutputId || null,
          siteId: selectedSiteId || null,
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
        setLoading(false)
        return
      }

      router.push('/admin/ftth/odp')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setLoading(false)
    }
  }

  if (loading) return <div className="text-sm text-gray-500">Memuat...</div>
  if (error && !name) return <div className="text-sm text-red-600">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit ODP</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <div className="space-y-4">
          <h2 className="text-md font-semibold text-gray-900 dark:text-white">Data Dasar</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Nama ODP</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>

            <div className="space-y-1">
              <ImageUpload
                label="Foto ODP (opsional)"
                value={images}
                onChange={setImages}
                folder="ftth/odp"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Lokasi (opsional)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Catatan (opsional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Keterangan Jumlah Kabel Feeder (opsional)</label>
              <input value={keteranganJumlahKabelFeeder} onChange={(e) => setKeteranganJumlahKabelFeeder(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm" placeholder="Contoh: 12 Core, 24 Core, dll" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as 'AKTIF' | 'NONAKTIF' | 'MAINTENANCE')} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Site (Opsional)</label>
              <select name="siteId" value={selectedSiteId} onChange={(e) => setSelectedSiteId(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih Site --</option>
                {sites.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
              </select>
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
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih ODC (Opsional)</label>
              <select value={selectedOdcId} onChange={(e) => setSelectedOdcId(e.target.value)} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih ODC --</option>
                {odcs.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-800 dark:text-gray-200">Pilih Slot</label>
              <select value={selectedOutputId} onChange={(e) => setSelectedOutputId(e.target.value)} disabled={!selectedOdcId} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm">
                <option value="">-- Pilih Slot --</option>
                {outputs.sort((a, b) => a.idx - b.idx).map((s) => (
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
                      <input value={row.slotName} onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, slotName: e.target.value } : r))} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" step="0.01" value={row.redaman} onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, redaman: e.target.value } : r))} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm" />
                    </div>
                    <div className="col-span-3">
                      <select value={row.tubeColor} onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, tubeColor: e.target.value } : r))} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm">
                        {TUBE_COLOR_OPTIONS.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <select value={row.coreColor} onChange={(e) => setOutputCores((prev) => prev.map((r, idx) => idx === i ? { ...r, coreColor: e.target.value } : r))} className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm">
                        {STANDARD_12_COLORS.map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button type="button" onClick={() => handleRemoveOutput(i)} className="inline-flex items-center justify-center h-8 w-8 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label="Hapus">
                        <HiTrash className="h-4 w-4" />
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


