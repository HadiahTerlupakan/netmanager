"use client";

import type { Dispatch, SetStateAction } from "react";
import { HiMagnifyingGlass } from "react-icons/hi2";
import type {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
} from "react-hook-form";
import type { MitraFormState, Site } from "./types";
import {
  INPUT_CLASS,
  TEKNISI_RATE_INPUT_CLASS,
  FormSectionDivider,
  FieldLabel,
} from "./MitraFormShared";

export interface MitraFormJobSectionProps {
  readonly register: UseFormRegister<MitraFormState>;
  readonly setValue: UseFormSetValue<MitraFormState>;
  readonly watch: UseFormWatch<MitraFormState>;
  readonly sites: readonly Site[];
  readonly mixradiusOwners: readonly string[];
  readonly ownerSearchTerm: string;
  readonly setOwnerSearchTerm: Dispatch<SetStateAction<string>>;
}

export function MitraFormJobSection({
  register,
  setValue,
  watch,
  sites,
  mixradiusOwners,
  ownerSearchTerm,
  setOwnerSearchTerm,
}: MitraFormJobSectionProps) {
  const employeeType = watch("employeeType");
  const enableFeePelanggan = watch("enableFeePelanggan");
  const selectedOwners = watch("mixradiusOwnerNames") ?? [];

  const toggleOwner = (owner: string, checked: boolean) => {
    const next = checked
      ? [...selectedOwners, owner]
      : selectedOwners.filter((o: string) => o !== owner);
    setValue("mixradiusOwnerNames", next);
  };

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
        <>
          <div>
            <FieldLabel>Rate Canvasing (Rp)</FieldLabel>
            <input
              type="number"
              {...register("mitraRateCanvasing")}
              className={INPUT_CLASS}
              placeholder="25000"
            />
          </div>

          <div className="md:col-span-2 mt-2">
            <label className="flex items-center cursor-pointer gap-3 w-max">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={enableFeePelanggan}
                  onChange={(e) =>
                    setValue("enableFeePelanggan", e.target.checked)
                  }
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-gray-300">
                Aktifkan Fee Pelanggan Berbayar
              </span>
            </label>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Jika diaktifkan, mitra sales akan mendapatkan fee dari setiap
              pelanggan unik yang melakukan pembayaran.
            </p>
          </div>

          {enableFeePelanggan && (
            <>
              <div>
                <FieldLabel>Fee per Pelanggan (Rp/Bln)</FieldLabel>
                <input
                  type="number"
                  {...register("mitraRateFeePelanggan")}
                  className={INPUT_CLASS}
                  placeholder="Cth: 10000"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Fee komisi per pelanggan aktif per bulan (berdasar MixRadius).
                </p>
              </div>
              <div className="md:col-span-2 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pilih Owners MixRadius ({selectedOwners.length} dipilih)
                  </label>
                  <div className="relative w-1/2">
                    <HiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                    <input
                      type="text"
                      placeholder="Cari owner..."
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500"
                      value={ownerSearchTerm}
                      onChange={(e) => setOwnerSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 h-60 overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mixradiusOwners.length === 0 ? (
                      <div className="col-span-2 text-center text-gray-500 py-4">
                        Memuat owners...
                      </div>
                    ) : (
                      mixradiusOwners
                        .filter((owner) =>
                          owner
                            .toLowerCase()
                            .includes(ownerSearchTerm.toLowerCase()),
                        )
                        .map((owner, index) => {
                          const isSelected = selectedOwners.includes(owner);
                          return (
                            <label
                              key={`${owner}-${index}`}
                              className={`flex items-start gap-2 p-2 rounded cursor-pointer border hover:border-indigo-400 transition-colors ${
                                isSelected
                                  ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800"
                                  : "bg-white border-transparent dark:bg-gray-800"
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                checked={isSelected}
                                onChange={(e) =>
                                  toggleOwner(owner, e.target.checked)
                                }
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 break-words line-clamp-2">
                                {owner}
                              </span>
                            </label>
                          );
                        })
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Pelanggan dari Owner yang dipilih akan masuk ke perhitungan
                  komisi fee per pelanggan.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}
