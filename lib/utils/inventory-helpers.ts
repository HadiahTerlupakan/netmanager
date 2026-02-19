/**
 * Inventory Shared Helpers
 * Centralized utility functions for inventory components
 * Eliminates duplication across MasukForm, KeluarForm, DetailMasukModal, DetailKeluarModal, TransferForm
 */

/** Get Tailwind CSS classes for kondisi badge */
export function getKondisiColor(kondisi: string): string {
  switch (kondisi) {
    case 'BARU': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
    case 'BEKAS': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
    case 'RUSAK': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
  }
}

/** Alias for getKondisiColor (used in Detail modals as getKondisiBadge) */
export const getKondisiBadge = getKondisiColor

/** Get stock status color based on quantity */
export function getStockStatusColor(stock: number): string {
  if (stock === 0) return 'text-red-600 font-bold'
  if (stock < 5) return 'text-yellow-600 font-semibold'
  return 'text-green-600'
}

/** Format date string for Indonesian locale display */
export function formatInventoryDate(dateString: string): string {
  return new Date(dateString).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
