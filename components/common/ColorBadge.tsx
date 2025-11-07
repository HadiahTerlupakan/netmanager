type ColorBadgeProps = {
  color: string
  label?: string
  size?: 'sm' | 'md'
}

const colorMap: Record<string, string> = {
  'Biru': '#3b82f6',
  'Oranye': '#f97316',
  'Hijau': '#22c55e',
  'Coklat': '#a16207',
  'Slate': '#64748b',
  'Putih': '#ffffff',
  'Merah': '#ef4444',
  'Hitam': '#000000',
  'Kuning': '#eab308',
  'Ungu': '#a855f7',
  'Rose': '#f43f5e',
  'Aqua': '#06b6d4',
}

function getColorHex(colorName: string): string {
  const normalized = colorName.trim()
  if (colorMap[normalized]) {
    return colorMap[normalized]
  }
  // Jika sudah hex color
  if (normalized.startsWith('#')) {
    return normalized
  }
  // Default gray jika tidak ditemukan
  return '#9ca3af'
}

export function ColorBadge({ color, label, size = 'md' }: ColorBadgeProps) {
  if (!color || color.trim() === '' || color === 'Non-tube') {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 ${
        size === 'sm' ? 'text-xs' : 'text-sm'
      }`}>
        <span className={`w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 ${
          size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
        }`} />
        {label || color || 'Non-tube'}
      </span>
    )
  }

  const hexColor = getColorHex(color)
  const isLight = hexColor === '#ffffff' || hexColor === '#eab308' || hexColor === '#06b6d4'
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${
      isLight ? 'border-gray-300 dark:border-gray-600' : 'border-transparent'
    } ${
      size === 'sm' ? 'text-xs' : 'text-sm'
    }`} style={{ 
      backgroundColor: hexColor === '#ffffff' ? '#f9fafb' : `${hexColor}20`,
      color: hexColor === '#ffffff' || hexColor === '#eab308' || hexColor === '#06b6d4' ? '#1f2937' : hexColor,
    }}>
      <span 
        className={`rounded-full border ${
          size === 'sm' ? 'w-2 h-2' : 'w-3 h-3'
        } ${
          isLight ? 'border-gray-400' : 'border-transparent'
        }`}
        style={{ backgroundColor: hexColor }}
      />
      {label || color}
    </span>
  )
}

