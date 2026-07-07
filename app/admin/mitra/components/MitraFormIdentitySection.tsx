"use client";

import type { ChangeEvent } from "react";
import type {
  FieldErrors,
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import type { MitraFormState } from "./types";
import {
  INPUT_CLASS,
  FormSectionDivider,
  FieldLabel,
  FieldError,
} from "./MitraFormShared";

export interface MitraFormIdentitySectionProps {
  readonly register: UseFormRegister<MitraFormState>;
  readonly setValue: UseFormSetValue<MitraFormState>;
  readonly watch: UseFormWatch<MitraFormState>;
  readonly errors: FieldErrors<MitraFormState>;
  readonly onFileUpload: (
    e: ChangeEvent<HTMLInputElement>,
    field: string,
    onUploaded: (url: string) => void,
  ) => Promise<void>;
  readonly isEdit: boolean;
}

type FotoField = "fotoDiri" | "fotoKtp" | "fotoSim" | "fotoKk";

const DOCUMENT_FIELDS: ReadonlyArray<{ field: FotoField; label: string }> = [
  { field: "fotoDiri", label: "Foto Diri / Pasfoto" },
  { field: "fotoKtp", label: "Foto KTP" },
  { field: "fotoSim", label: "Foto SIM" },
  { field: "fotoKk", label: "Foto Kartu Keluarga" },
];

export function MitraFormIdentitySection({
  register,
  setValue,
  watch,
  errors,
  onFileUpload,
  isEdit,
}: MitraFormIdentitySectionProps) {
  return (
    <>
      <div>
        <FieldLabel>Nama *</FieldLabel>
        <input
          type="text"
          {...register("name")}
          className={INPUT_CLASS}
          placeholder="Nama mitra"
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <FieldLabel>Email *</FieldLabel>
        <input
          type="email"
          {...register("email")}
          className={INPUT_CLASS}
          placeholder="email@contoh.com"
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <FieldLabel>Password</FieldLabel>
        <input
          type="password"
          {...register("password")}
          className={INPUT_CLASS}
          placeholder={
            isEdit ? "Kosongkan jika tidak ingin diubah" : "••••••••"
          }
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div>
        <FieldLabel>Telepon</FieldLabel>
        <input
          type="text"
          {...register("phone")}
          className={INPUT_CLASS}
          placeholder="08xxxxxxxxxx"
        />
      </div>

      <FormSectionDivider label="Informasi Data Diri (KYC)" />
      <div>
        <FieldLabel>NIK</FieldLabel>
        <input
          type="text"
          {...register("nik")}
          className={INPUT_CLASS}
          placeholder="Nomor Induk Kependudukan"
        />
      </div>
      <div>
        <FieldLabel>Tempat Lahir</FieldLabel>
        <input
          type="text"
          {...register("tempatLahir")}
          className={INPUT_CLASS}
          placeholder="Contoh: Jakarta"
        />
      </div>
      <div>
        <FieldLabel>Tanggal Lahir</FieldLabel>
        <input
          type="date"
          {...register("tanggalLahir")}
          className={INPUT_CLASS}
        />
        <FieldError message={errors.tanggalLahir?.message} />
      </div>
      <div className="md:col-span-1">
        <FieldLabel>Alamat Domisili</FieldLabel>
        <textarea
          {...register("alamat")}
          className={INPUT_CLASS}
          placeholder="Alamat domisili"
          rows={1}
        />
      </div>
      <div>
        <FieldLabel>Latitude Rumah</FieldLabel>
        <input
          type="number"
          step="any"
          {...register("latitudeRumah")}
          className={INPUT_CLASS}
          placeholder="-6.123456"
        />
        <FieldError message={errors.latitudeRumah?.message} />
      </div>
      <div>
        <FieldLabel>Longitude Rumah</FieldLabel>
        <input
          type="number"
          step="any"
          {...register("longitudeRumah")}
          className={INPUT_CLASS}
          placeholder="106.123456"
        />
        <FieldError message={errors.longitudeRumah?.message} />
      </div>

      <FormSectionDivider label="Dokumen Pendukung (Maksimal 5MB/file)" />
      {DOCUMENT_FIELDS.map(({ field, label }) => {
        const currentUrl = watch(field) as string;
        return (
          <div key={field}>
            <FieldLabel>{label}</FieldLabel>
            <div className="flex items-center gap-3">
              {currentUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={currentUrl}
                    alt={label}
                    className="h-10 w-10 object-cover rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800"
                  />
                </>
              )}
              <input
                type="file"
                accept="image/*"
                onChange={(e) =>
                  onFileUpload(e, field, (url: string) => setValue(field, url))
                }
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-400"
              />
            </div>
          </div>
        );
      })}
    </>
  );
}
