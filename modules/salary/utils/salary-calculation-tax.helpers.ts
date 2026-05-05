import type { PtkpStatus } from "../domain/entities/SalaryEntity";

/** Hitung potongan PPh21 TER berdasarkan status PTKP. */
export function calculatePph21Ter(
  grossIncome: number,
  ptkpStatus: PtkpStatus,
): number {
  let rate = 0;

  if (["TK_0", "TK_1", "K_0"].includes(ptkpStatus)) {
    if (grossIncome <= 5400000) rate = 0;
    else if (grossIncome <= 5650000) rate = 0.0025;
    else if (grossIncome <= 5950000) rate = 0.005;
    else if (grossIncome <= 6300000) rate = 0.0075;
    else if (grossIncome <= 6750000) rate = 0.01;
    else if (grossIncome <= 7500000) rate = 0.0125;
    else if (grossIncome <= 8550000) rate = 0.015;
    else if (grossIncome <= 9650000) rate = 0.0175;
    else if (grossIncome <= 10050000) rate = 0.02;
    else if (grossIncome <= 10350000) rate = 0.0225;
    else if (grossIncome <= 10700000) rate = 0.025;
    else rate = 0.03;
  } else if (["TK_2", "TK_3", "K_1", "K_2"].includes(ptkpStatus)) {
    if (grossIncome <= 6200000) rate = 0;
    else if (grossIncome <= 6500000) rate = 0.0025;
    else if (grossIncome <= 6850000) rate = 0.005;
    else if (grossIncome <= 7300000) rate = 0.0075;
    else if (grossIncome <= 9200000) rate = 0.015;
    else if (grossIncome <= 10750000) rate = 0.02;
    else rate = 0.03;
  } else if (["K_3"].includes(ptkpStatus)) {
    if (grossIncome <= 6600000) rate = 0;
    else if (grossIncome <= 6950000) rate = 0.0025;
    else if (grossIncome <= 7350000) rate = 0.005;
    else if (grossIncome <= 7800000) rate = 0.0075;
    else if (grossIncome <= 8850000) rate = 0.01;
    else rate = 0.03;
  }

  return Math.floor(grossIncome * rate);
}
