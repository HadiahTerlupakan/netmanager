import { SiteFilter } from '@/components/common/SiteFilter'

type PppClientSiteSectionProps = {
  siteId?: string
  helperText: string
  onSiteChange: (siteId?: string) => void
  roundedClassName: string
}

export function PppClientSiteSection({ siteId, helperText, onSiteChange, roundedClassName }: PppClientSiteSectionProps) {
  return (
    <div className={`bg-gray-50 dark:bg-gray-900/50 p-4 ${roundedClassName} border border-gray-200 dark:border-gray-700`}>
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Pilih Site <span className="text-red-500">*</span>
      </span>
      <div className="mb-2">
        <SiteFilter isInput={true} value={siteId ?? ''} onSiteChange={onSiteChange} />
      </div>
      <p className="text-xs text-gray-500">{helperText}</p>
    </div>
  )
}
