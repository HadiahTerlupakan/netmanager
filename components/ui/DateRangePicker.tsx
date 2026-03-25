'use client'

import { useState, useRef, useEffect } from 'react'
import { DateRange, type Range, type RangeKeyDict } from 'react-date-range'
import { format } from 'date-fns'
import { id } from 'date-fns/locale'
import { HiOutlineCalendarDays, HiOutlineChevronDown } from 'react-icons/hi2'

// Styles
import 'react-date-range/dist/styles.css' // main style file
import 'react-date-range/dist/theme/default.css' // theme css file

interface DateRangePickerProps {
    onChange: (range: { startDate: Date; endDate: Date }) => void
    initialRange?: { startDate: Date; endDate: Date }
    className?: string
}

export default function DateRangePicker({ onChange, initialRange, className = '' }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [state, setState] = useState<Range[]>([
        {
            startDate: initialRange?.startDate || new Date(),
            endDate: initialRange?.endDate || new Date(),
            key: 'selection'
        }
    ])
    
    const containerRef = useRef<HTMLDivElement>(null)

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelect = (ranges: RangeKeyDict) => {
        setState([ranges.selection])
    }

    const handleApply = () => {
        const selection = state[0]
        if (selection.startDate && selection.endDate) {
            onChange({
                startDate: selection.startDate,
                endDate: selection.endDate
            })
        }
        setIsOpen(false)
    }

    const rangeLabel = `${format(state[0].startDate!, 'dd MMM yyyy', { locale: id })} - ${format(state[0].endDate!, 'dd MMM yyyy', { locale: id })}`

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl text-xs font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
            >
                <HiOutlineCalendarDays className="w-4 h-4 text-indigo-500" />
                <span>{rangeLabel}</span>
                <HiOutlineChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 z-[60] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2">
                        <DateRange
                            editableDateInputs={true}
                            onChange={handleSelect}
                            moveRangeOnFirstSelection={false}
                            ranges={state}
                            locale={id}
                            rangeColors={['#4f46e5']} // Indigo-600
                            className="text-gray-900"
                        />
                    </div>
                    <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 flex justify-end">
                        <button
                            type="button"
                            onClick={handleApply}
                            className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 dark:shadow-none"
                        >
                            Terapkan
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
