import type { LocalItem } from "../../ItemDisbursementModal";

export type ValidationTargetTab = "info" | "growth" | "items" | "disbursement";

export interface RABFormValidationResult {
  isValid: boolean;
  errors: string[];
  targetTab?: ValidationTargetTab;
}

export function validateRABForm(
  formData: { name: string },
  items: LocalItem[],
): RABFormValidationResult {
  const validationErrors: string[] = [];

  if (!formData.name.trim()) {
    validationErrors.push("Nama proyek wajib diisi");
  }

  if (items.length === 0) {
    validationErrors.push("Minimal 1 item biaya harus ditambahkan");
  }

  const emptyItems = items.filter((item) => !item.name.trim());
  if (emptyItems.length > 0) {
    validationErrors.push(`${emptyItems.length} item belum diisi namanya`);
  }

  const zeroItems = items.filter((item) => item.unitPrice <= 0);
  if (zeroItems.length > 0) {
    validationErrors.push(`${zeroItems.length} item memiliki harga Rp 0`);
  }

  items.forEach((item, index) => {
    if (item.disbursements && item.disbursements.length > 0) {
      const totalPercent = item.disbursements.reduce(
        (sum: number, disbursement) => sum + disbursement.percentage,
        0,
      );

      if (Math.abs(totalPercent - 100) > 0.01) {
        validationErrors.push(
          `Item "${item.name || `Baris ${index + 1}`}" memiliki total persentase termin tidak 100% (saat ini ${totalPercent}%)`,
        );
      }
    }
  });

  if (validationErrors.length === 0) {
    return { isValid: true, errors: [] };
  }

  if (!formData.name.trim()) {
    return {
      isValid: false,
      errors: validationErrors,
      targetTab: "info",
    };
  }

  if (items.length === 0 || emptyItems.length > 0 || zeroItems.length > 0) {
    return {
      isValid: false,
      errors: validationErrors,
      targetTab: "items",
    };
  }

  return {
    isValid: false,
    errors: validationErrors,
  };
}
