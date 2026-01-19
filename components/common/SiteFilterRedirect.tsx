"use client"

import { useRouter, useSearchParams } from 'next/navigation'
import { SiteFilter } from '@/components/common/SiteFilter'

interface SiteFilterRedirectProps {
  baseUrl: string
  className?: string
}

export default function SiteFilterRedirect({ baseUrl, className }: SiteFilterRedirectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentSiteId = searchParams.get('siteId') || undefined

  const handleSiteChange = (siteId: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString())
    if (siteId) {
      params.set('siteId', siteId)
    } else {
      params.delete('siteId')
    }
    router.push(`${baseUrl}?${params.toString()}`)
  }

  return (
    <SiteFilter
      value={currentSiteId}
      onSiteChange={handleSiteChange}
      className={className}
    />
  )
}
