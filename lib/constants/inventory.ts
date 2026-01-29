/**
 * Constants for Inventory Module
 */

/**
 * Useful Life in Months for Asset Categories
 */
export const USEFUL_LIFE_MONTHS = {
    ELEKTRONIK: 48,    // 4 years
    KENDARAAN: 96,     // 8 years
    FURNITURE: 96,     // 8 years
    BANGUNAN: 240,     // 20 years
    LAINNYA: 48        // default 4 years
} as const

export type KategoriAsetType = keyof typeof USEFUL_LIFE_MONTHS

/**
 * Stock condition field mapping
 */
export const STOCK_FIELD_MAP = {
    BARU: 'stokBaru',
    BEKAS: 'stokBekas',
    RUSAK: 'stokRusak'
} as const

/**
 * Default stock condition
 */
export const DEFAULT_KONDISI = 'BARU' as const
