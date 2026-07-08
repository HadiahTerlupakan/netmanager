"use client";

import type {
  FieldErrors,
  UseFormRegister,
  UseFormWatch,
} from "react-hook-form";
import type { MitraFormState } from "./types";
import { INPUT_CLASS, FormSectionDivider, FieldLabel } from "./MitraFormShared";

export interface MitraFormBankGaransiSectionProps {
  readonly register: UseFormRegister<MitraFormState>;
  readonly watch: UseFormWatch<MitraFormState>;
  readonly errors: FieldErrors<MitraFormState>;
}

export function MitraFormBankGaransiSection({
  register,
  watch,
}: MitraFormBankGaransiSectionProps) {
  const employeeType = watch("employeeType");
  return (
    <>
      <FormSectionDivider label="Informasi Bank (Opsional)" />
      <div>
        <FieldLabel>Nama Bank</FieldLabel>
        <input
          type="text"
          {...register("bankName")}
          className={INPUT_CLASS}
          placeholder="BCA, BNI, Mandiri..."
        />
      </div>
      <div>
        <FieldLabel>No. Rekening</FieldLabel>
        <input
          type="text"
          {...register("bankAccountNo")}
          className={INPUT_CLASS}
          placeholder="1234567890"
        />
      </div>
      <div>
        <FieldLabel>Nama Pemilik Rekening</FieldLabel>
        <input
          type="text"
          {...register("bankAccountName")}
          className={INPUT_CLASS}
          placeholder="A.N John Doe"
        />
      </div>

      <FormSectionDivider label="Ketentuan Penarikan (Opsional)" />
      <div>
        <FieldLabel>Minimal Penarikan (Rp)</FieldLabel>
        <input
          type="number"
          {...register("minWithdrawal")}
          className={INPUT_CLASS}
          placeholder="Cth: 50000"
        />
        <p className="mt-1 text-xs text-gray-500">
          Kosongkan untuk mengikuti default sistem
        </p>
      </div>

      {employeeType === "MITRA_SALES" && (
        <div>
          <FieldLabel>Target Harian</FieldLabel>
          <input
            type="number"
            min="0"
            {...register("targetHarian")}
            className={INPUT_CLASS}
            placeholder="Contoh: 5"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Target jumlah closing yang harus dicapai setiap hari.
          </p>
        </div>
      )}

      <FormSectionDivider label="Pengaturan Garansi Mitra" />

      <div>
        <FieldLabel>Masa Garansi (Hari)</FieldLabel>
        <input
          type="number"
          min="0"
          {...register("garansiHari")}
          className={INPUT_CLASS}
          placeholder="Contoh: 7"
        />
      </div>

      <div>
        <FieldLabel>SLA Tunggu Lelang (Jam)</FieldLabel>
        <input
          type="number"
          min="0"
          {...register("slaGaransiJam")}
          className={INPUT_CLASS}
          placeholder="Contoh: 24"
        />
      </div>

      <div>
        <FieldLabel>Denda Garansi PSB (Rp)</FieldLabel>
        <input
          type="number"
          min="0"
          {...register("penaltyPsb")}
          className={INPUT_CLASS}
          placeholder="Contoh: 50000"
        />
      </div>

      <div>
        <FieldLabel>Denda Garansi MTC (Rp)</FieldLabel>
        <input
          type="number"
          min="0"
          {...register("penaltyMaintenance")}
          className={INPUT_CLASS}
          placeholder="Contoh: 30000"
        />
      </div>
    </>
  );
}
