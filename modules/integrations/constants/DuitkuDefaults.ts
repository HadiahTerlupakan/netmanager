// Standard Duitku Fees (Updated Feb 2026 based on duitku.com/harga)
export const DUITKU_DEFAULT_FEES: Record<string, { type: 'FIXED' | 'PERCENT'; value: number }> = {
    // Virtual Accounts
    'BC': { type: 'FIXED', value: 5000 },      // BCA VA
    'M2': { type: 'FIXED', value: 4000 },      // Mandiri VA
    'VA': { type: 'FIXED', value: 3000 },      // Maybank VA (Lainnya)
    'B1': { type: 'FIXED', value: 3000 },      // CIMB Niaga VA (Lainnya)
    'BT': { type: 'FIXED', value: 3000 },      // Permata VA (Lainnya)
    'A1': { type: 'FIXED', value: 3000 },      // ATM Bersama VA (Lainnya)
    'BNC': { type: 'FIXED', value: 3000 },     // Neo Commerce VA (Lainnya)
    'BR': { type: 'FIXED', value: 3000 },      // BRI VA (Lainnya)
    'BN': { type: 'FIXED', value: 3000 },      // BNI VA (Lainnya)
    'DANAMON': { type: 'FIXED', value: 3000 }, // Danamon VA (Lainnya)
    'AG': { type: 'FIXED', value: 1500 },      // Artha Graha
    'SS': { type: 'FIXED', value: 1500 },      // Sahabat Sampoerna

    // E-Wallets
    'OV': { type: 'PERCENT', value: 1.67 },    // OVO
    'DA': { type: 'PERCENT', value: 1.67 },    // DANA
    'LA': { type: 'PERCENT', value: 1.67 },    // LinkAja
    'SA': { type: 'PERCENT', value: 2.0 },     // ShopeePay (2%)
    'SP': { type: 'PERCENT', value: 2.0 },     // ShopeePay (2%)

    // QRIS
    'QRIS': { type: 'PERCENT', value: 0.7 },   // QRIS Payment
    'SPQR': { type: 'PERCENT', value: 0.7 },   // ShopeePay QRIS

    // Retail
    'FT': { type: 'FIXED', value: 2500 },      // Alfamart, Pegadaian, POS
    'IR': { type: 'FIXED', value: 1000 },      // Indomaret (+MDR)

    // Credit Card
    'VC': { type: 'PERCENT', value: 2.9 },     // Visa/Mastercard (2.9% + Rp 2.500)

    // Paylater
    'AT': { type: 'PERCENT', value: 5.5 },     // Atome
    'ID': { type: 'PERCENT', value: 2.3 },     // Indodana
}

// Helper to normalize payment method names from report to Duitku codes
// This maps the string found in "payment_method" column to the keys above
export const normalizePaymentMethod = (methodName: string): string | null => {
    const lower = methodName.toLowerCase().trim()

    if (lower.includes('bca')) return 'BC'
    if (lower.includes('mandiri')) return 'M2'
    if (lower.includes('bri')) return 'BR'
    if (lower.includes('bni')) return 'BN'
    if (lower.includes('permata')) return 'BT'
    if (lower.includes('cimb')) return 'B1'
    if (lower.includes('maybank')) return 'VA'
    if (lower.includes('danamon')) return 'DANAMON'
    if (lower.includes('artha graha')) return 'AG'
    if (lower.includes('sampoerna')) return 'SS'
    if (lower.includes('atm bersama') || lower.includes('bersama')) return 'A1'

    if (lower.includes('qris')) return 'QRIS'
    if (lower.includes('ovo')) return 'OV'
    if (lower.includes('dana')) return 'DA'
    if (lower.includes('linkaja')) return 'LA'
    if (lower.includes('shopeepay')) return 'SA'

    if (lower.includes('alfamart') || lower.includes('pegadaian') || lower.includes('pos')) return 'FT'
    if (lower.includes('indomaret')) return 'IR'

    if (lower.includes('visa') || lower.includes('master') || lower.includes('credit')) return 'VC'
    if (lower.includes('atome')) return 'AT'
    if (lower.includes('indodana')) return 'ID'

    return null
}
