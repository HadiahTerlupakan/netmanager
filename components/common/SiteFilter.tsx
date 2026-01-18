"use client"

import { useEffect, useState } from 'react'
import { HiOutlineMap } from 'react-icons/hi2'

interface Site {
  id: string
  name: string
}

interface SiteFilterProps {
  onSiteChange: (siteId: string | undefined) => void
  className?: string
}

export function SiteFilter({ onSiteChange, className = '' }: SiteFilterProps) {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSite, setSelectedSite] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/sites')
      .then((res) => res.json())
      .then((data) => {
        setSites(data.sites || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to fetch sites:', err)
        setLoading(false)
      })
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setSelectedSite(val)
    onSiteChange(val === '' ? undefined : val)
  }

  if (loading) return <div className="animate-pulse h-10 w-48 bg-gray-200 rounded"></div>

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <HiOutlineMap className="h-5 w-5 text-gray-400" />
      </div>
      <select
        value={selectedSite}
        onChange={handleChange}
        className="block w-full pl-10 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md shadow-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
      >
        <option value="">Semua Site</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </div>
  )
}
