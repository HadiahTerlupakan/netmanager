export interface BpjsProgramRate {
  employeeRate: number;
  employerRate: number;
  maxBase: number | null;
  maxAge?: number;
}

export interface BpjsEmployerOnlyRate {
  employerRate: number;
  riskCategory?: number;
}

export interface BpjsRateConfig {
  kesehatan: BpjsProgramRate;
  jht: BpjsProgramRate;
  jp: BpjsProgramRate & { maxAge: number };
  jkk: BpjsEmployerOnlyRate;
  jkm: BpjsEmployerOnlyRate;
}

export const DEFAULT_BPJS_CONFIG: BpjsRateConfig = {
  kesehatan: { employeeRate: 0.01, employerRate: 0.04, maxBase: 12000000 },
  jht: { employeeRate: 0.02, employerRate: 0.037, maxBase: null },
  jp: { employeeRate: 0.01, employerRate: 0.02, maxBase: 10042000, maxAge: 57 },
  jkk: { employerRate: 0.0024, riskCategory: 1 },
  jkm: { employerRate: 0.003 },
};
