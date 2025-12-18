/**
 * Budget Integration Helper
 * Maps Pengeluaran categories to Budget categories and handles budget updates
 */

export interface CategoryMapping {
    pengeluaranKategori: string;
    budgetCategory: string;
    type: 'OPEX' | 'CAPEX';
}

/**
 * Mapping dari kategori Pengeluaran ke Budget Category
 */
export const KATEGORI_MAPPING: CategoryMapping[] = [
    // OPEX Mappings
    { pengeluaranKategori: 'OPERASIONAL', budgetCategory: 'OPEX_OPERASIONAL', type: 'OPEX' },
    { pengeluaranKategori: 'GAJI', budgetCategory: 'OPEX_GAJI', type: 'OPEX' },
    { pengeluaranKategori: 'MARKETING', budgetCategory: 'OPEX_MARKETING', type: 'OPEX' },
    { pengeluaranKategori: 'VENDOR', budgetCategory: 'OPEX_VENDOR', type: 'OPEX' },
    { pengeluaranKategori: 'MAINTENANCE', budgetCategory: 'OPEX_MAINTENANCE', type: 'OPEX' },
    { pengeluaranKategori: 'ADMINISTRASI', budgetCategory: 'OPEX_ADMINISTRATIF', type: 'OPEX' },

    // ISP-Specific OPEX Mappings
    { pengeluaranKategori: 'BANDWIDTH', budgetCategory: 'OPEX_BANDWIDTH_UPSTREAM', type: 'OPEX' },
    { pengeluaranKategori: 'NOC', budgetCategory: 'OPEX_NOC_OPERATIONS', type: 'OPEX' },
    { pengeluaranKategori: 'TEKNISI', budgetCategory: 'OPEX_FIELD_TECHNICIAN', type: 'OPEX' },
    { pengeluaranKategori: 'CUSTOMER_ACQ', budgetCategory: 'OPEX_CUSTOMER_ACQUISITION', type: 'OPEX' },
    { pengeluaranKategori: 'USO_CONTRIBUTION', budgetCategory: 'OPEX_USO_CONTRIBUTION', type: 'OPEX' },
    // CAPEX Mappings
    { pengeluaranKategori: 'INFRASTRUKTUR', budgetCategory: 'CAPEX_INFRASTRUKTUR_JARINGAN', type: 'CAPEX' },
    { pengeluaranKategori: 'PERALATAN', budgetCategory: 'CAPEX_PERALATAN', type: 'CAPEX' },
    { pengeluaranKategori: 'TEKNOLOGI', budgetCategory: 'CAPEX_TEKNOLOGI', type: 'CAPEX' },
    { pengeluaranKategori: 'BANGUNAN', budgetCategory: 'CAPEX_BANGUNAN', type: 'CAPEX' },

    // ISP-Specific CAPEX Mappings
    { pengeluaranKategori: 'FIBER', budgetCategory: 'CAPEX_FIBER_DEPLOYMENT', type: 'CAPEX' },
    { pengeluaranKategori: 'EQUIPMENT_CORE', budgetCategory: 'CAPEX_CORE_EQUIPMENT', type: 'CAPEX' },
    { pengeluaranKategori: 'INFRASTRUKTUR_PASIF', budgetCategory: 'CAPEX_PASSIVE_INFRASTRUCTURE', type: 'CAPEX' },
];

/**
 * Get budget category from pengeluaran kategori
 */
export function getBudgetCategory(pengeluaranKategori: string): string | null {
    const mapping = KATEGORI_MAPPING.find(
        m => m.pengeluaranKategori === pengeluaranKategori
    );
    return mapping?.budgetCategory || null;
}

/**
 * Get budget type (OPEX/CAPEX) from pengeluaran kategori
 */
export function getBudgetType(pengeluaranKategori: string): 'OPEX' | 'CAPEX' | null {
    const mapping = KATEGORI_MAPPING.find(
        m => m.pengeluaranKategori === pengeluaranKategori
    );
    return mapping?.type || null;
}

/**
 * Check if a pengeluaran kategori can be mapped to budget
 */
export function canMapTobudget(pengeluaranKategori: string): boolean {
    return KATEGORI_MAPPING.some(m => m.pengeluaranKategori === pengeluaranKategori);
}
