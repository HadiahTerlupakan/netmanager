'use client'

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { MdExpandMore, MdSearch, MdClose } from 'react-icons/md'

export interface ComboboxOption {
    value: string
    label: string | ReactNode
    searchLabel?: string
    disabled?: boolean
}

interface ComboboxProps {
    options: ComboboxOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    onSearch?: (query: string) => void // New prop for async search
    loading?: boolean // New prop for loading state
}

export function Combobox({
    options,
    value,
    onChange,
    placeholder = 'Select option',
    disabled = false,
    className = '',
    onSearch,
    loading = false
}: ComboboxProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

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

    const handleSearch = (newQuery: string) => {
        setQuery(newQuery)

        if (onSearch) {
            if (debounceTimeout.current) clearTimeout(debounceTimeout.current)
            debounceTimeout.current = setTimeout(() => {
                onSearch(newQuery)
            }, 300) // Debounce 300ms
        }
    }

    // Filter options locally if no onSearch provided
    const filteredOptions = onSearch
        ? options
        : query === ''
            ? options
            : options.filter((option) => {
                const searchStr = (option.searchLabel || (typeof option.label === 'string' ? option.label : '')).toLowerCase()
                return searchStr.includes(query.toLowerCase())
            })

    const handleSelect = (optionValue: string) => {
        onChange(optionValue)
        setIsOpen(false)
        setQuery('')
        // Reset search if async
        if (onSearch) onSearch('')
    }

    // Find selected option (logic remains same)
    const selectedOption = options.find(opt => opt.value === value)

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                className={`
                    w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1c2936] border 
                    border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-blue-500 transition-colors'}
                `}
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="flex-1 truncate mr-2">
                    {selectedOption
                        ? (typeof selectedOption.label === 'string' ? <span className="text-gray-900 dark:text-white">{selectedOption.label}</span> : selectedOption.label)
                        : <span className="text-gray-400">{placeholder}</span>
                    }
                </div>
                <MdExpandMore className={`text-xl text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1c2936] border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden">
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-[#1c2936]">
                        <div className="relative">
                            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full pl-9 pr-8 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Cari..."
                                value={query}
                                onChange={(e) => handleSearch(e.target.value)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                            {query && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        handleSearch('') // Clear search
                                        inputRef.current?.focus()
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <MdClose />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-gray-500 animate-pulse">Memuat...</div>
                        ) : filteredOptions.length === 0 ? (
                            <div className="p-3 text-center text-sm text-gray-500">Tidak ditemukan</div>
                        ) : (
                            <>
                                {filteredOptions.slice(0, 50).map((option) => (
                                    <button
                                        key={option.value}
                                        className={`
                                        w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors
                                        ${option.value === value
                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                                                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                            }
                                        ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                                    `}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (!option.disabled) handleSelect(option.value)
                                        }}
                                        disabled={option.disabled}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                                {filteredOptions.length > 50 && (
                                    <div className="p-2 text-center text-xs text-gray-400 border-t border-gray-100 dark:border-gray-700">
                                        Menampilkan 50 dari {filteredOptions.length} opsi. Ketik untuk mencari lainnya.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
