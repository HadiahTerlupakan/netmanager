'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { FiSearch, FiChevronDown, FiX, FiInfo } from 'react-icons/fi'

interface Option {
  value: string
  label: string
  subLabel?: string
  badge?: React.ReactNode
}

interface SearchableSelectProps {
  options: Option[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Pilih opsi...',
  disabled = false,
  className = ''
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = useMemo(() => 
    options.find(opt => opt.value === value), 
  [options, value])

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase()
    return options.filter(opt => 
      opt.label.toLowerCase().includes(term) || 
      opt.subLabel?.toLowerCase().includes(term)
    )
  }, [options, search])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative ${className} ${isOpen ? 'z-[100]' : ''}`}>
      {/* Trigger */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`group flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900/50 border rounded-2xl cursor-pointer transition-all duration-200 ${
          isOpen 
            ? 'ring-4 ring-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/5' 
            : 'border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800' : ''}`}
      >
        <div className="flex-1 truncate">
          {selectedOption ? (
            <div className="flex flex-col">
              <span className="text-sm font-black text-gray-900 dark:text-white truncate">
                {selectedOption.label}
              </span>
              {selectedOption.subLabel && (
                <div className="flex items-center gap-1 mt-0.5">
                    <FiInfo className="text-[10px] text-indigo-400" />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate font-medium">
                    {selectedOption.subLabel}
                    </span>
                </div>
              )}
            </div>
          ) : (
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-3 ml-3 border-l border-gray-100 dark:border-gray-800 pl-3">
          {value && !disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
              }}
              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors group/x"
            >
              <FiX className="text-gray-400 group-hover/x:text-red-500 text-sm" />
            </button>
          )}
          <FiChevronDown className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : 'group-hover:text-gray-600'}`} />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[110] w-full mt-2 bg-white dark:bg-gray-800 rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-gray-100 dark:border-gray-700 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="p-4 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="relative group">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                autoFocus
                type="text"
                placeholder="Cari nama atau kode barang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 shadow-inner"
              />
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value)
                    setIsOpen(false)
                    setSearch('')
                  }}
                  className={`group/item flex items-center justify-between px-4 py-3.5 rounded-2xl cursor-pointer transition-all mb-1 ${
                    value === opt.value 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                      : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className={`text-sm font-bold truncate ${value === opt.value ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {opt.label}
                    </div>
                    {opt.subLabel && (
                      <div className={`text-[10px] font-medium truncate mt-0.5 ${value === opt.value ? 'text-indigo-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {opt.subLabel}
                      </div>
                    )}
                  </div>
                  {opt.badge && (
                    <div className="shrink-0 transition-transform group-hover/item:scale-110">
                      {opt.badge}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="px-4 py-12 text-center">
                <div className="w-12 h-12 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiSearch className="text-gray-300" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-bold tracking-tight">Barang tidak ditemukan</p>
                <p className="text-[10px] text-gray-400 mt-1 uppercase font-black">Coba kata kunci lain</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
