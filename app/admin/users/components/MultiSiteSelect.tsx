"use client"
import { useState, useEffect, useRef } from 'react'
import { HiOutlineMap, HiOutlineCheck, HiOutlineStar, HiChevronDown, HiXMark } from 'react-icons/hi2'

interface Site {
  id: string
  code: string
  name: string
}

interface SelectedSite {
  siteId: string
  isPrimary: boolean
}

interface MultiSiteSelectProps {
  sites: Site[]
  selectedSites: SelectedSite[]
  onChange: (sites: SelectedSite[]) => void
  disabled?: boolean
  error?: string
}

/**
 * Multi-Site Selection Component
 * Allows selecting multiple sites with a primary site designation
 */
export default function MultiSiteSelect({
  sites,
  selectedSites,
  onChange,
  disabled = false,
  error
}: MultiSiteSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const isSelected = (siteId: string) => {
    return selectedSites.some(s => s.siteId === siteId)
  }

  const isPrimarySite = (siteId: string) => {
    return selectedSites.find(s => s.siteId === siteId)?.isPrimary || false
  }

  const toggleSite = (siteId: string) => {
    if (isSelected(siteId)) {
      // Remove site
      const newSites = selectedSites.filter(s => s.siteId !== siteId)
      // If removed site was primary, make first remaining site primary
      if (isPrimarySite(siteId) && newSites.length > 0) {
        const firstSite = newSites[0]
        if (firstSite) {
            firstSite.isPrimary = true
        }
      }
      onChange(newSites)
    } else {
      // Add site (make primary if first one)
      const newSite: SelectedSite = {
        siteId,
        isPrimary: selectedSites.length === 0
      }
      onChange([...selectedSites, newSite])
    }
  }

  const setPrimaryClick = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation()
    const newSites = selectedSites.map(s => ({
      ...s,
      isPrimary: s.siteId === siteId
    }))
    onChange(newSites)
  }

  const removeSite = (e: React.MouseEvent, siteId: string) => {
    e.stopPropagation()
    toggleSite(siteId)
  }

  const selectedSiteObjects = selectedSites
    .map(s => sites.find(site => site.id === s.siteId))
    .filter(Boolean) as Site[]

  const primarySite = selectedSites.find(s => s.isPrimary)
  const primarySiteObj = primarySite ? sites.find(s => s.id === primarySite.siteId) : null

  return (
    <div className="space-y-2" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Site / Area Kerja
      </label>

      {/* Selected Sites Display */}
      <div
        className={`relative min-h-[48px] w-full px-3 py-2 border rounded-lg cursor-pointer transition-colors ${
          disabled 
            ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' 
            : 'bg-white dark:bg-gray-700 hover:border-indigo-400'
        } ${
          error 
            ? 'border-red-300 dark:border-red-700' 
            : isOpen 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
              : 'border-gray-300 dark:border-gray-600'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2 flex-wrap pr-8">
          <HiOutlineMap className="h-5 w-5 text-gray-400 shrink-0" />
          
          {selectedSiteObjects.length === 0 ? (
            <span className="text-gray-400">Pilih Site (bisa lebih dari satu)</span>
          ) : (
            selectedSiteObjects.map(site => {
              const isPrimary = isPrimarySite(site.id)
              return (
                <span
                  key={site.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium ${
                    isPrimary
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-600 dark:text-gray-300'
                  }`}
                >
                  {isPrimary && <HiOutlineStar className="w-3 h-3" />}
                  {site.code}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={(e) => removeSite(e, site.id)}
                      className="ml-1 hover:text-red-500 transition-colors"
                    >
                      <HiXMark className="w-3 h-3" />
                    </button>
                  )}
                </span>
              )
            })
          )}
        </div>

        <HiChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
          {sites.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
              Tidak ada site tersedia
            </div>
          ) : (
            sites.map(site => {
              const selected = isSelected(site.id)
              const primary = isPrimarySite(site.id)
              
              return (
                <div
                  key={site.id}
                  className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                  }`}
                  onClick={() => toggleSite(site.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selected 
                        ? 'bg-indigo-600 border-indigo-600' 
                        : 'border-gray-300 dark:border-gray-600'
                    }`}>
                      {selected && <HiOutlineCheck className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{site.code}</span>
                      <span className="text-gray-500 dark:text-gray-400 ml-2">{site.name}</span>
                    </div>
                  </div>

                  {selected && (
                    <button
                      type="button"
                      onClick={(e) => setPrimaryClick(e, site.id)}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                        primary
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                      }`}
                      title={primary ? 'Site Utama' : 'Jadikan Site Utama'}
                    >
                      <div className="flex items-center gap-1">
                        <HiOutlineStar className="w-3 h-3" />
                        {primary ? 'Utama' : 'Set Utama'}
                      </div>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Primary Site Info */}
      {primarySiteObj && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          <HiOutlineStar className="w-3 h-3 text-indigo-500" />
          Site utama: <span className="font-medium">{primarySiteObj.name}</span>
        </p>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
