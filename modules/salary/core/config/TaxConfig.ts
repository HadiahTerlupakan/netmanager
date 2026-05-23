import type { TaxMethod } from "../domain/enums";

export interface ProgressiveRate {
  minAmount: number;
  maxAmount: number | null;
  rate: number;
}

export interface TerBracket {
  ptkpGroup: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

export interface PtkpAmount {
  status: string;
  annualAmount: number;
}

export interface TenantTaxConfig {
  defaultMethod: TaxMethod;
  terYear: number;
  npwpSurcharge: number;
  annualCorrectionMonth: number;
  biayaJabatanRate: number;
  biayaJabatanMax: number;
  biayaJabatanMaxAnnual: number;
  progressiveRates: ProgressiveRate[];
  terBrackets: TerBracket[];
  ptkpTable: PtkpAmount[];
}

/**
 * TER brackets per PMK 168/2023, Lampiran A.
 * Berlaku untuk perhitungan PPh 21 bulanan Januari–November.
 * Bulan Desember tetap pakai tarif progresif tahunan untuk koreksi.
 *
 * Kategori PTKP (Pasal 2 PMK 168/2023):
 *   A: TK/0 (54 jt), TK/1 (58.5 jt), K/0 (58.5 jt)
 *   B: TK/2 (63 jt), TK/3 (67.5 jt), K/1 (63 jt), K/2 (67.5 jt)
 *   C: K/3 (72 jt)
 *
 * Sumber bracket: Lampiran A PMK 168 Tahun 2023.
 */
const TER_BRACKETS_PMK_168: TerBracket[] = [
  // Kategori A
  { ptkpGroup: "A", minIncome: 0, maxIncome: 5400000, rate: 0.0 },
  { ptkpGroup: "A", minIncome: 5400000, maxIncome: 5650000, rate: 0.0025 },
  { ptkpGroup: "A", minIncome: 5650000, maxIncome: 5950000, rate: 0.005 },
  { ptkpGroup: "A", minIncome: 5950000, maxIncome: 6300000, rate: 0.0075 },
  { ptkpGroup: "A", minIncome: 6300000, maxIncome: 6750000, rate: 0.01 },
  { ptkpGroup: "A", minIncome: 6750000, maxIncome: 7500000, rate: 0.0125 },
  { ptkpGroup: "A", minIncome: 7500000, maxIncome: 8550000, rate: 0.015 },
  { ptkpGroup: "A", minIncome: 8550000, maxIncome: 9650000, rate: 0.0175 },
  { ptkpGroup: "A", minIncome: 9650000, maxIncome: 10050000, rate: 0.02 },
  { ptkpGroup: "A", minIncome: 10050000, maxIncome: 10350000, rate: 0.0225 },
  { ptkpGroup: "A", minIncome: 10350000, maxIncome: 10700000, rate: 0.025 },
  { ptkpGroup: "A", minIncome: 10700000, maxIncome: 11050000, rate: 0.03 },
  { ptkpGroup: "A", minIncome: 11050000, maxIncome: 11600000, rate: 0.035 },
  { ptkpGroup: "A", minIncome: 11600000, maxIncome: 12500000, rate: 0.04 },
  { ptkpGroup: "A", minIncome: 12500000, maxIncome: 13750000, rate: 0.05 },
  { ptkpGroup: "A", minIncome: 13750000, maxIncome: 15100000, rate: 0.06 },
  { ptkpGroup: "A", minIncome: 15100000, maxIncome: 16950000, rate: 0.07 },
  { ptkpGroup: "A", minIncome: 16950000, maxIncome: 19750000, rate: 0.08 },
  { ptkpGroup: "A", minIncome: 19750000, maxIncome: 24150000, rate: 0.09 },
  { ptkpGroup: "A", minIncome: 24150000, maxIncome: 26450000, rate: 0.1 },
  { ptkpGroup: "A", minIncome: 26450000, maxIncome: 28000000, rate: 0.11 },
  { ptkpGroup: "A", minIncome: 28000000, maxIncome: 30050000, rate: 0.12 },
  { ptkpGroup: "A", minIncome: 30050000, maxIncome: 32400000, rate: 0.13 },
  { ptkpGroup: "A", minIncome: 32400000, maxIncome: 35400000, rate: 0.14 },
  { ptkpGroup: "A", minIncome: 35400000, maxIncome: 39100000, rate: 0.15 },
  { ptkpGroup: "A", minIncome: 39100000, maxIncome: 43850000, rate: 0.16 },
  { ptkpGroup: "A", minIncome: 43850000, maxIncome: 47800000, rate: 0.17 },
  { ptkpGroup: "A", minIncome: 47800000, maxIncome: 51400000, rate: 0.18 },
  { ptkpGroup: "A", minIncome: 51400000, maxIncome: 56300000, rate: 0.19 },
  { ptkpGroup: "A", minIncome: 56300000, maxIncome: 62200000, rate: 0.2 },
  { ptkpGroup: "A", minIncome: 62200000, maxIncome: 68600000, rate: 0.21 },
  { ptkpGroup: "A", minIncome: 68600000, maxIncome: 77500000, rate: 0.22 },
  { ptkpGroup: "A", minIncome: 77500000, maxIncome: 89000000, rate: 0.23 },
  { ptkpGroup: "A", minIncome: 89000000, maxIncome: 103000000, rate: 0.24 },
  { ptkpGroup: "A", minIncome: 103000000, maxIncome: 125000000, rate: 0.25 },
  { ptkpGroup: "A", minIncome: 125000000, maxIncome: 157000000, rate: 0.26 },
  { ptkpGroup: "A", minIncome: 157000000, maxIncome: 206000000, rate: 0.27 },
  { ptkpGroup: "A", minIncome: 206000000, maxIncome: 337000000, rate: 0.28 },
  { ptkpGroup: "A", minIncome: 337000000, maxIncome: 454000000, rate: 0.29 },
  { ptkpGroup: "A", minIncome: 454000000, maxIncome: 550000000, rate: 0.3 },
  { ptkpGroup: "A", minIncome: 550000000, maxIncome: 695000000, rate: 0.31 },
  { ptkpGroup: "A", minIncome: 695000000, maxIncome: 910000000, rate: 0.32 },
  { ptkpGroup: "A", minIncome: 910000000, maxIncome: 1400000000, rate: 0.33 },
  { ptkpGroup: "A", minIncome: 1400000000, maxIncome: null, rate: 0.34 },

  // Kategori B
  { ptkpGroup: "B", minIncome: 0, maxIncome: 6200000, rate: 0.0 },
  { ptkpGroup: "B", minIncome: 6200000, maxIncome: 6500000, rate: 0.0025 },
  { ptkpGroup: "B", minIncome: 6500000, maxIncome: 6850000, rate: 0.005 },
  { ptkpGroup: "B", minIncome: 6850000, maxIncome: 7300000, rate: 0.0075 },
  { ptkpGroup: "B", minIncome: 7300000, maxIncome: 9200000, rate: 0.01 },
  { ptkpGroup: "B", minIncome: 9200000, maxIncome: 10750000, rate: 0.015 },
  { ptkpGroup: "B", minIncome: 10750000, maxIncome: 11250000, rate: 0.02 },
  { ptkpGroup: "B", minIncome: 11250000, maxIncome: 11600000, rate: 0.025 },
  { ptkpGroup: "B", minIncome: 11600000, maxIncome: 12600000, rate: 0.03 },
  { ptkpGroup: "B", minIncome: 12600000, maxIncome: 13600000, rate: 0.04 },
  { ptkpGroup: "B", minIncome: 13600000, maxIncome: 14950000, rate: 0.05 },
  { ptkpGroup: "B", minIncome: 14950000, maxIncome: 16400000, rate: 0.06 },
  { ptkpGroup: "B", minIncome: 16400000, maxIncome: 18450000, rate: 0.07 },
  { ptkpGroup: "B", minIncome: 18450000, maxIncome: 21850000, rate: 0.08 },
  { ptkpGroup: "B", minIncome: 21850000, maxIncome: 26000000, rate: 0.09 },
  { ptkpGroup: "B", minIncome: 26000000, maxIncome: 27700000, rate: 0.1 },
  { ptkpGroup: "B", minIncome: 27700000, maxIncome: 29350000, rate: 0.11 },
  { ptkpGroup: "B", minIncome: 29350000, maxIncome: 31450000, rate: 0.12 },
  { ptkpGroup: "B", minIncome: 31450000, maxIncome: 33950000, rate: 0.13 },
  { ptkpGroup: "B", minIncome: 33950000, maxIncome: 37100000, rate: 0.14 },
  { ptkpGroup: "B", minIncome: 37100000, maxIncome: 41100000, rate: 0.15 },
  { ptkpGroup: "B", minIncome: 41100000, maxIncome: 45800000, rate: 0.16 },
  { ptkpGroup: "B", minIncome: 45800000, maxIncome: 49500000, rate: 0.17 },
  { ptkpGroup: "B", minIncome: 49500000, maxIncome: 53800000, rate: 0.18 },
  { ptkpGroup: "B", minIncome: 53800000, maxIncome: 58500000, rate: 0.19 },
  { ptkpGroup: "B", minIncome: 58500000, maxIncome: 64000000, rate: 0.2 },
  { ptkpGroup: "B", minIncome: 64000000, maxIncome: 71000000, rate: 0.21 },
  { ptkpGroup: "B", minIncome: 71000000, maxIncome: 80000000, rate: 0.22 },
  { ptkpGroup: "B", minIncome: 80000000, maxIncome: 93000000, rate: 0.23 },
  { ptkpGroup: "B", minIncome: 93000000, maxIncome: 109000000, rate: 0.24 },
  { ptkpGroup: "B", minIncome: 109000000, maxIncome: 129000000, rate: 0.25 },
  { ptkpGroup: "B", minIncome: 129000000, maxIncome: 163000000, rate: 0.26 },
  { ptkpGroup: "B", minIncome: 163000000, maxIncome: 211000000, rate: 0.27 },
  { ptkpGroup: "B", minIncome: 211000000, maxIncome: 374000000, rate: 0.28 },
  { ptkpGroup: "B", minIncome: 374000000, maxIncome: 459000000, rate: 0.29 },
  { ptkpGroup: "B", minIncome: 459000000, maxIncome: 555000000, rate: 0.3 },
  { ptkpGroup: "B", minIncome: 555000000, maxIncome: 704000000, rate: 0.31 },
  { ptkpGroup: "B", minIncome: 704000000, maxIncome: 957000000, rate: 0.32 },
  { ptkpGroup: "B", minIncome: 957000000, maxIncome: 1405000000, rate: 0.33 },
  { ptkpGroup: "B", minIncome: 1405000000, maxIncome: null, rate: 0.34 },

  // Kategori C
  { ptkpGroup: "C", minIncome: 0, maxIncome: 6600000, rate: 0.0 },
  { ptkpGroup: "C", minIncome: 6600000, maxIncome: 6950000, rate: 0.0025 },
  { ptkpGroup: "C", minIncome: 6950000, maxIncome: 7350000, rate: 0.005 },
  { ptkpGroup: "C", minIncome: 7350000, maxIncome: 7800000, rate: 0.0075 },
  { ptkpGroup: "C", minIncome: 7800000, maxIncome: 8850000, rate: 0.01 },
  { ptkpGroup: "C", minIncome: 8850000, maxIncome: 9800000, rate: 0.0125 },
  { ptkpGroup: "C", minIncome: 9800000, maxIncome: 10950000, rate: 0.015 },
  { ptkpGroup: "C", minIncome: 10950000, maxIncome: 11200000, rate: 0.0175 },
  { ptkpGroup: "C", minIncome: 11200000, maxIncome: 12050000, rate: 0.02 },
  { ptkpGroup: "C", minIncome: 12050000, maxIncome: 12950000, rate: 0.03 },
  { ptkpGroup: "C", minIncome: 12950000, maxIncome: 14150000, rate: 0.04 },
  { ptkpGroup: "C", minIncome: 14150000, maxIncome: 15550000, rate: 0.05 },
  { ptkpGroup: "C", minIncome: 15550000, maxIncome: 17050000, rate: 0.06 },
  { ptkpGroup: "C", minIncome: 17050000, maxIncome: 19500000, rate: 0.07 },
  { ptkpGroup: "C", minIncome: 19500000, maxIncome: 22700000, rate: 0.08 },
  { ptkpGroup: "C", minIncome: 22700000, maxIncome: 26600000, rate: 0.09 },
  { ptkpGroup: "C", minIncome: 26600000, maxIncome: 28100000, rate: 0.1 },
  { ptkpGroup: "C", minIncome: 28100000, maxIncome: 30100000, rate: 0.11 },
  { ptkpGroup: "C", minIncome: 30100000, maxIncome: 32600000, rate: 0.12 },
  { ptkpGroup: "C", minIncome: 32600000, maxIncome: 35400000, rate: 0.13 },
  { ptkpGroup: "C", minIncome: 35400000, maxIncome: 38900000, rate: 0.14 },
  { ptkpGroup: "C", minIncome: 38900000, maxIncome: 43000000, rate: 0.15 },
  { ptkpGroup: "C", minIncome: 43000000, maxIncome: 47400000, rate: 0.16 },
  { ptkpGroup: "C", minIncome: 47400000, maxIncome: 51200000, rate: 0.17 },
  { ptkpGroup: "C", minIncome: 51200000, maxIncome: 55800000, rate: 0.18 },
  { ptkpGroup: "C", minIncome: 55800000, maxIncome: 60400000, rate: 0.19 },
  { ptkpGroup: "C", minIncome: 60400000, maxIncome: 66700000, rate: 0.2 },
  { ptkpGroup: "C", minIncome: 66700000, maxIncome: 74500000, rate: 0.21 },
  { ptkpGroup: "C", minIncome: 74500000, maxIncome: 83200000, rate: 0.22 },
  { ptkpGroup: "C", minIncome: 83200000, maxIncome: 95600000, rate: 0.23 },
  { ptkpGroup: "C", minIncome: 95600000, maxIncome: 110000000, rate: 0.24 },
  { ptkpGroup: "C", minIncome: 110000000, maxIncome: 134000000, rate: 0.25 },
  { ptkpGroup: "C", minIncome: 134000000, maxIncome: 169000000, rate: 0.26 },
  { ptkpGroup: "C", minIncome: 169000000, maxIncome: 221000000, rate: 0.27 },
  { ptkpGroup: "C", minIncome: 221000000, maxIncome: 390000000, rate: 0.28 },
  { ptkpGroup: "C", minIncome: 390000000, maxIncome: 463000000, rate: 0.29 },
  { ptkpGroup: "C", minIncome: 463000000, maxIncome: 561000000, rate: 0.3 },
  { ptkpGroup: "C", minIncome: 561000000, maxIncome: 709000000, rate: 0.31 },
  { ptkpGroup: "C", minIncome: 709000000, maxIncome: 965000000, rate: 0.32 },
  { ptkpGroup: "C", minIncome: 965000000, maxIncome: 1419000000, rate: 0.33 },
  { ptkpGroup: "C", minIncome: 1419000000, maxIncome: null, rate: 0.34 },
];

export const DEFAULT_TAX_CONFIG: TenantTaxConfig = {
  defaultMethod: "NET",
  terYear: 2024,
  npwpSurcharge: 0.2,
  annualCorrectionMonth: 12,
  biayaJabatanRate: 0.05,
  biayaJabatanMax: 500000,
  biayaJabatanMaxAnnual: 6000000,
  progressiveRates: [
    { minAmount: 0, maxAmount: 60000000, rate: 0.05 },
    { minAmount: 60000000, maxAmount: 250000000, rate: 0.15 },
    { minAmount: 250000000, maxAmount: 500000000, rate: 0.25 },
    { minAmount: 500000000, maxAmount: 5000000000, rate: 0.3 },
    { minAmount: 5000000000, maxAmount: null, rate: 0.35 },
  ],
  terBrackets: TER_BRACKETS_PMK_168,
  ptkpTable: [
    // Lajang
    { status: "TK_0", annualAmount: 54000000 },
    { status: "TK_1", annualAmount: 58500000 },
    { status: "TK_2", annualAmount: 63000000 },
    { status: "TK_3", annualAmount: 67500000 },
    // Kawin
    { status: "K_0", annualAmount: 58500000 },
    { status: "K_1", annualAmount: 63000000 },
    { status: "K_2", annualAmount: 67500000 },
    { status: "K_3", annualAmount: 72000000 },
    // Kawin, penghasilan istri digabung (PTKP K + PTKP istri 54 jt)
    { status: "KI_0", annualAmount: 112500000 },
    { status: "KI_1", annualAmount: 117000000 },
    { status: "KI_2", annualAmount: 121500000 },
    { status: "KI_3", annualAmount: 126000000 },
  ],
};
