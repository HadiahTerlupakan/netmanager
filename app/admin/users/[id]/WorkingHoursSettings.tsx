"use client"

import { useState, useEffect } from "react"
import { HiOutlineClock, HiOutlineCalendar, HiOutlineSun, HiOutlineBriefcase } from "react-icons/hi2"

enum WorkingHourMode {
    FIXED = 'FIXED',
    SHIFT = 'SHIFT',
    FLEXIBLE = 'FLEXIBLE'
}

interface Shift {
    id: string
    name: string
    code: string | null
    startTime: string
    endTime: string
}

interface WorkingHoursSettingsProps {
    initialData: {
        workingHourMode: string
        startWorkTime?: string | null
        endWorkTime?: string | null
        workDays?: string | null
        flexibleTargetHour?: number | null
        shiftId?: string | null
    }
    onChange: (data: any) => void
}

export default function WorkingHoursSettings({ initialData, onChange }: WorkingHoursSettingsProps) {
    const [mode, setMode] = useState<WorkingHourMode>((initialData.workingHourMode as WorkingHourMode) || WorkingHourMode.FIXED)
    const [startTime, setStartTime] = useState(initialData.startWorkTime || "09:00")
    const [endTime, setEndTime] = useState(initialData.endWorkTime || "17:00")
    const [selectedDays, setSelectedDays] = useState<string[]>(initialData.workDays ? initialData.workDays.split(',') : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'])
    const [targetHours, setTargetHours] = useState(initialData.flexibleTargetHour || 8)
    const [selectedShiftId, setSelectedShiftId] = useState(initialData.shiftId || '')
    const [shifts, setShifts] = useState<Shift[]>([])
    const [loadingShifts, setLoadingShifts] = useState(false)

    const days = [
        { id: 'Mon', label: 'Senin' },
        { id: 'Tue', label: 'Selasa' },
        { id: 'Wed', label: 'Rabu' },
        { id: 'Thu', label: 'Kamis' },
        { id: 'Fri', label: 'Jumat' },
        { id: 'Sat', label: 'Sabtu' },
        { id: 'Sun', label: 'Minggu' },
    ]

    // Fetch shifts when mode is SHIFT
    useEffect(() => {
        if (mode === WorkingHourMode.SHIFT && shifts.length === 0) {
            setLoadingShifts(true)
            fetch('/api/admin/shifts')
                .then(res => res.json())
                .then(data => setShifts(data))
                .catch(err => console.error('Error fetching shifts:', err))
                .finally(() => setLoadingShifts(false))
        }
    }, [mode, shifts.length])

    useEffect(() => {
        // Notify parent of changes
        const data: any = { workingHourMode: mode }

        if (mode === WorkingHourMode.FIXED) {
            data.startWorkTime = startTime
            data.endWorkTime = endTime
            data.workDays = selectedDays.join(',')
            data.shiftId = null
        } else if (mode === WorkingHourMode.FLEXIBLE) {
            data.flexibleTargetHour = targetHours
            data.shiftId = null
        } else if (mode === WorkingHourMode.SHIFT) {
            data.shiftId = selectedShiftId || null
            data.workDays = selectedDays.join(',')
        }

        onChange(data)
    }, [mode, startTime, endTime, selectedDays, targetHours, selectedShiftId])

    const toggleDay = (dayId: string) => {
        if (selectedDays.includes(dayId)) {
            setSelectedDays(selectedDays.filter(d => d !== dayId))
        } else {
            setSelectedDays([...selectedDays, dayId])
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 bg-linear-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <HiOutlineClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Pengaturan Jam Kerja</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Konfigurasi jadwal kerja pengguna untuk sistem absensi</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Mode Selection */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        type="button"
                        onClick={() => setMode(WorkingHourMode.FIXED)}
                        className={`p-4 border rounded-xl flex flex-col items-center gap-3 transition-all ${mode === WorkingHourMode.FIXED
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                    >
                        <HiOutlineBriefcase className={`w-8 h-8 ${mode === WorkingHourMode.FIXED ? 'text-blue-600' : 'text-gray-400'}`} />
                        <div className="text-center">
                            <span className={`block font-semibold ${mode === WorkingHourMode.FIXED ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>Jam Kerja Tetap</span>
                            <span className="text-xs text-gray-500">Jadwal Harian Pasti</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode(WorkingHourMode.SHIFT)}
                        className={`p-4 border rounded-xl flex flex-col items-center gap-3 transition-all ${mode === WorkingHourMode.SHIFT
                                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-2 ring-purple-200 dark:ring-purple-800'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                    >
                        <HiOutlineCalendar className={`w-8 h-8 ${mode === WorkingHourMode.SHIFT ? 'text-purple-600' : 'text-gray-400'}`} />
                        <div className="text-center">
                            <span className={`block font-semibold ${mode === WorkingHourMode.SHIFT ? 'text-purple-700 dark:text-purple-300' : 'text-gray-700 dark:text-gray-300'}`}>Jam Kerja Shift</span>
                            <span className="text-xs text-gray-500">Mengikuti Pola Shift</span>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setMode(WorkingHourMode.FLEXIBLE)}
                        className={`p-4 border rounded-xl flex flex-col items-center gap-3 transition-all ${mode === WorkingHourMode.FLEXIBLE
                                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-200 dark:ring-green-800'
                                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                            }`}
                    >
                        <HiOutlineSun className={`w-8 h-8 ${mode === WorkingHourMode.FLEXIBLE ? 'text-green-600' : 'text-gray-400'}`} />
                        <div className="text-center">
                            <span className={`block font-semibold ${mode === WorkingHourMode.FLEXIBLE ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>Jam Kerja Fleksibel</span>
                            <span className="text-xs text-gray-500">Bebas & Target Jam</span>
                        </div>
                    </button>
                </div>

                {/* Content based on Mode */}
                {mode === WorkingHourMode.FIXED && (
                    <div className="space-y-6 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jam Masuk</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Jam Pulang</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                    </div>
                )}

                {mode === WorkingHourMode.SHIFT && (
                    <div className="space-y-4 animate-fadeIn">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Pilih Shift
                            </label>
                            {loadingShifts ? (
                                <div className="text-sm text-gray-500">Memuat data shift...</div>
                            ) : shifts.length === 0 ? (
                                <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-100 dark:border-yellow-900">
                                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                                        Belum ada shift yang tersedia. Silakan buat shift di menu Kehadiran → Manajemen Shift.
                                    </p>
                                </div>
                            ) : (
                                <select
                                    value={selectedShiftId}
                                    onChange={(e) => setSelectedShiftId(e.target.value)}
                                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">-- Pilih Shift --</option>
                                    {shifts.map(shift => (
                                        <option key={shift.id} value={shift.id}>
                                            {shift.name} ({shift.startTime} - {shift.endTime})
                                        </option>
                                    ))}
                                </select>
                            )}
                            {selectedShiftId && shifts.find(s => s.id === selectedShiftId) && (
                                <p className="text-sm text-purple-600 dark:text-purple-400 mt-2">
                                    Jadwal: {shifts.find(s => s.id === selectedShiftId)?.startTime} - {shifts.find(s => s.id === selectedShiftId)?.endTime}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {mode === WorkingHourMode.FLEXIBLE && (
                    <div className="space-y-4 animate-fadeIn">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Target Jam Kerja (per hari)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max="24"
                                    value={targetHours}
                                    onChange={(e) => setTargetHours(Number(e.target.value))}
                                    className="block w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
                                />
                                <span className="text-gray-500">Jam</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                Pengguna bebas melakukan check-in kapan saja, namun diharapkan memenuhi target jam kerja harian.
                            </p>
                        </div>
                    </div>
                )}

                {(mode === WorkingHourMode.FIXED || mode === WorkingHourMode.SHIFT) && (
                    <div className="space-y-4 animate-fadeIn border-t border-gray-100 dark:border-gray-700 pt-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Hari Kerja</label>
                            <div className="flex flex-wrap gap-2">
                                {days.map(day => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        onClick={() => toggleDay(day.id)}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDays.includes(day.id)
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                            }`}
                                    >
                                        {day.label}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                                Pilih hari di mana pengguna ini diharapkan masuk kerja. Hari yang tidak dipilih akan dianggap sebagai hari libur (Off).
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
