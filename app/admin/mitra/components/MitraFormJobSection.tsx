"use client";

import type { UseFormRegister, UseFormWatch } from "react-hook-form";
import type { MitraFormState, Site } from "./types";
import {
  INPUT_CLASS,
  TEKNISI_RATE_INPUT_CLASS,
  FormSectionDivider,
  FieldLabel,
} from "./MitraFormShared";

export interface MitraFormJobSectionProps {
  readonly register: UseFormRegister<MitraFormState>;
  readonly watch: UseFormWatch<MitraFormState>;
  readonly sites: readonly Site[];
}

export function MitraFormJobSection({
  register,
  watch,
  sites,
}: MitraFormJobSectionProps) {
  const employeeType = watch("employeeType");

  return (
    <>
      <FormSectionDivider label="Informasi Pekerjaan" />
      <div>
        <FieldLabel>Tipe Mitra *</FieldLabel>
        <select {...register("employeeType")} className={INPUT_CLASS}>
          <option value="MITRA_TEKNISI">Mitra Teknisi</option>
          <option value="MITRA_SALES">Mitra Sales</option>
        </select>
      </div>
      <div>
        <FieldLabel>Site / Lokasi</FieldLabel>
        <select {...register("siteId")} className={INPUT_CLASS}>
          <option value="">— Pilih Site —</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.name}
            </option>
          ))}
        </select>
      </div>

      {employeeType === "MITRA_TEKNISI" && (
        <>
          <div>
            <FieldLabel>Rate WO PSB</FieldLabel>
            <input
              type="number"
              className={TEKNISI_RATE_INPUT_CLASS}
              {...register("mitraRateWoPsb")}
              placeholder="Cth: 50000"
            />
          </div>
          <div>
            <FieldLabel>Rate WO Maintenance</FieldLabel>
            <input
              type="number"
              className={TEKNISI_RATE_INPUT_CLASS}
              {...register("mitraRateWoMaintenance")}
              placeholder="Cth: 20000"
            />
          </div>
        </>
      )}

      {employeeType === "MITRA_SALES" && (
        <div>
          <FieldLabel>Rate Canvasing (Rp)</FieldLabel>
          <input
            type="number"
            {...register("mitraRateCanvasing")}
            className={INPUT_CLASS}
            placeholder="25000"
          />
        </div>
      )}
    </>
  );
}
