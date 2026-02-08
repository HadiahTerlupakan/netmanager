'use client'

import { useState, useEffect, useCallback } from 'react'
import { FiChevronLeft, FiChevronRight, FiTrash2, FiCalendar } from 'react-icons/fi'
import { getWithAuth, postWithAuth, deleteWithAuth } from '@/lib/api-client'
import { Modal, ModalFooter } from '@/components/ui/Modal'
import { usePermission } from '@/hooks/use-permission'

interface Holiday {
    id: string
    date: string
    description: string
    isNational: boolean
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

export function HolidayClient() {
    const { hasPermission } = usePermission()
    const canCreate = hasPermission('izin:create') // Proxy for holiday management
    const canDelete = hasPermission('izin:delete')

    const [currentDate, setCurrentDate] = useState(new Date())
    const [holidays, setHolidays] = useState<Holiday[]>([])
    const [_loading, setLoading] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [selectedDate, setSelectedDate] = useState<string>('') // YYYY-MM-DD
    const [description, setDescription] = useState('')
    const [isNational, setIsNational] = useState(true)

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const fetchHolidays = useCallback(async () => {
        setLoading(true)
        try {
            const res = await getWithAuth(`/api/admin/holidays?year=${year}`)
            if (res.ok) {
                const data = await res.json()
                setHolidays(data.data || [])
            }
        } catch (err) {
            console.error('Failed to fetch holidays', err)
        } finally {
            setLoading(false)
        }
    }, [year])

    useEffect(() => {
        fetchHolidays()
    }, [fetchHolidays])

    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1))
    }

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1))
    }

    const handleDateClick = (dateStr: string) => {
        if (!canCreate) return

        setSelectedDate(dateStr)
        const holiday = holidays.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr)
        if (holiday) {
            alert('Tanggal ini sudah ada event: ' + holiday.description + '. Hapus dulu jika ingin mengganti.')
            return
        }
        setDescription('')
        setIsNational(true)
        setShowModal(true)
    }

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        if (!confirm('Hapus hari libur ini?')) return

        try {
            const res = await deleteWithAuth(`/api/admin/holidays/${id}`)
            if (res.ok) {
                fetchHolidays()
            }
        } catch (err) {
            console.error(err)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await postWithAuth('/api/admin/holidays', {
                date: selectedDate,
                description,
                isNational
            })
            if (res.ok) {
                setShowModal(false)
                fetchHolidays()
            } else {
                const data = await res.json()
                alert(data.error || 'Gagal menyimpan')
            }
        } catch (err) {
            console.error(err)
        }
    }

    const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
    const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay()

    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)
    const blanks = Array(firstDay).fill(null)
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white pb-2 flex items-center gap-2">
                    <FiCalendar /> Pengaturan Hari Libur
                </h1>
                <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-l-lg border-r border-gray-200 dark:border-gray-700">
                        <FiChevronLeft />
                    </button>
                    <div className="px-4 py-2 font-semibold min-w-[150px] text-center">
                        {MONTHS[month]} {year}
                    </div>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-r-lg border-l border-gray-200 dark:border-gray-700">
                        <FiChevronRight />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {DAYS.map(day => (
                        <div key={day} className={`p-4 text-center font-semibold text-sm ${day === 'Minggu' ? 'text-red-500' : 'text-gray-600 dark:text-gray-300'}`}>
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-fr bg-gray-200 dark:bg-gray-700 gap-px">
                    {blanks.map((_, i) => (
                        <div key={`blank-${i}`} className="bg-white dark:bg-gray-800 min-h-[120px] p-2" />
                    ))}

                    {days.map(day => {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const holiday = holidays.find(h => new Date(h.date).toISOString().split('T')[0] === dateStr)
                        const isToday = new Date().toISOString().split('T')[0] === dateStr
                        const isSunday = new Date(year, month, day).getDay() === 0

                        return (
                            <div
                                key={day}
                                onClick={() => canCreate && handleDateClick(dateStr)}
                                className={`bg-white dark:bg-gray-800 min-h-[120px] p-2 relative group transition-colors
                    ${canCreate ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-750' : ''}
                    ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}
                `}
                            >
                                <div className="flex justify-between items-start">
                                    <span className={`
                        w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                        ${isToday ? 'bg-blue-600 text-white shadow-md' : isSunday ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}
                    `}>
                                        {day}
                                    </span>
                                    {holiday && canDelete && (
                                        <button
                                            onClick={(e) => handleDelete(holiday.id, e)}
                                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                            title="Hapus"
                                        >
                                            <FiTrash2 size={14} />
                                        </button>
                                    )}
                                </div>

                                {holiday && (
                                    <div className={`mt-2 p-2 rounded text-xs border ${holiday.isNational
                                        ? 'bg-red-50 border-red-100 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200'
                                        : 'bg-green-50 border-green-100 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200'
                                        }`}>
                                        <div className="font-semibold truncate" title={holiday.description}>{holiday.description}</div>
                                        <div className="text-[10px] opacity-75 mt-0.5">
                                            {holiday.isNational ? 'Libur Nasional' : 'Cuti Bersama'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-100 border border-red-200 rounded"></div>
                    <span>Libur Nasional</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
                    <span>Cuti Bersama</span>
                </div>
                {canCreate && (
                    <span className="ml-auto">Klik tanggal untuk menambah/edit libur</span>
                )}
            </div>

            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Tambah Hari Libur"
            >
                <form id="holiday-form" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tanggal</label>
                            <input
                                type="date"
                                required
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Keterangan</label>
                            <input
                                type="text"
                                id="holiday-description"
                                required
                                placeholder="Contoh: Tahun Baru Masehi"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm"
                            />
                        </div>

                        <div className="flex items-center pt-2">
                            <input
                                id="isNational"
                                type="checkbox"
                                checked={isNational}
                                onChange={e => setIsNational(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <label htmlFor="isNational" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                Libur Nasional (Off Day)
                            </label>
                        </div>
                    </div>
                    <ModalFooter>
                        <button
                            type="button"
                            onClick={() => setShowModal(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                            Simpan
                        </button>
                    </ModalFooter>
                </form>
            </Modal>
        </div>
    )
}
