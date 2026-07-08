import type { Mitra, MitraFormState } from "./types";

export const initialFormState: MitraFormState = {
  name: "",
  email: "",
  password: "",
  phone: "",
  employeeType: "MITRA_TEKNISI",
  siteId: "",
  mitraRateWoPsb: "",
  mitraRateWoMaintenance: "",
  mitraRateCanvasing: "",
  minWithdrawal: "",
  bankName: "",
  bankAccountNo: "",
  bankAccountName: "",
  targetHarian: "",
  garansiHari: "",
  slaGaransiJam: "",
  penaltyPsb: "",
  penaltyMaintenance: "",
  mitraRateFeePelanggan: "",
  enableFeePelanggan: false,
  mixradiusOwnerNames: [],
  nik: "",
  tempatLahir: "",
  tanggalLahir: "",
  alamat: "",
  latitudeRumah: "",
  longitudeRumah: "",
  fotoDiri: "",
  fotoKtp: "",
  fotoSim: "",
  fotoKk: "",
};

const optionalFloat = (value: string): number | undefined =>
  value ? parseFloat(value) : undefined;

const optionalInt = (value: string): number | undefined =>
  value ? parseInt(value, 10) : undefined;

export function buildAddPayload(form: MitraFormState) {
  return {
    ...form,
    siteId: form.siteId || undefined,
    mitraRateWoPsb: optionalFloat(form.mitraRateWoPsb),
    mitraRateWoMaintenance: optionalFloat(form.mitraRateWoMaintenance),
    mitraRateCanvasing: optionalFloat(form.mitraRateCanvasing),
    minWithdrawal: optionalFloat(form.minWithdrawal),
    targetHarian: optionalInt(form.targetHarian),
    garansiHari: optionalInt(form.garansiHari),
    slaGaransiJam: optionalInt(form.slaGaransiJam),
    penaltyPsb: optionalFloat(form.penaltyPsb),
    penaltyMaintenance: optionalFloat(form.penaltyMaintenance),
    mitraRateFeePelanggan: optionalFloat(form.mitraRateFeePelanggan),
    enableFeePelanggan: form.enableFeePelanggan,
    mixradiusOwnerNames:
      form.mixradiusOwnerNames.length > 0
        ? form.mixradiusOwnerNames
        : undefined,
    nik: form.nik || undefined,
    tempatLahir: form.tempatLahir || undefined,
    tanggalLahir: form.tanggalLahir || undefined,
    alamat: form.alamat || undefined,
    latitudeRumah: optionalFloat(form.latitudeRumah),
    longitudeRumah: optionalFloat(form.longitudeRumah),
    fotoDiri: form.fotoDiri || undefined,
    fotoKtp: form.fotoKtp || undefined,
    fotoSim: form.fotoSim || undefined,
    fotoKk: form.fotoKk || undefined,
  };
}

export function buildEditPayload(form: MitraFormState) {
  return {
    name: form.name,
    email: form.email,
    password: form.password || undefined,
    phone: form.phone || undefined,
    employeeType: form.employeeType,
    siteId: form.siteId || null,
    mitraRateWoPsb: optionalFloat(form.mitraRateWoPsb),
    mitraRateWoMaintenance: optionalFloat(form.mitraRateWoMaintenance),
    mitraRateCanvasing: optionalFloat(form.mitraRateCanvasing),
    minWithdrawal: optionalFloat(form.minWithdrawal),
    bankName: form.bankName || undefined,
    bankAccountNo: form.bankAccountNo || undefined,
    bankAccountName: form.bankAccountName || undefined,
    targetHarian: optionalInt(form.targetHarian),
    garansiHari: optionalInt(form.garansiHari),
    slaGaransiJam: optionalInt(form.slaGaransiJam),
    penaltyPsb: optionalFloat(form.penaltyPsb),
    penaltyMaintenance: optionalFloat(form.penaltyMaintenance),
    mitraRateFeePelanggan: optionalFloat(form.mitraRateFeePelanggan),
    enableFeePelanggan: form.enableFeePelanggan,
    mixradiusOwnerNames: form.mixradiusOwnerNames,
    nik: form.nik || undefined,
    tempatLahir: form.tempatLahir || undefined,
    tanggalLahir: form.tanggalLahir || undefined,
    alamat: form.alamat || undefined,
    latitudeRumah: optionalFloat(form.latitudeRumah),
    longitudeRumah: optionalFloat(form.longitudeRumah),
    fotoDiri: form.fotoDiri || undefined,
    fotoKtp: form.fotoKtp || undefined,
    fotoSim: form.fotoSim || undefined,
    fotoKk: form.fotoKk || undefined,
  };
}

export function mitraToFormState(mitra: Mitra): MitraFormState {
  return {
    name: mitra.name || "",
    email: mitra.email,
    password: "",
    phone: mitra.phone || "",
    employeeType: mitra.mitraType,
    siteId: mitra.siteId || "",
    mitraRateWoPsb: mitra.mitraRateWoPsb?.toString() || "",
    mitraRateWoMaintenance: mitra.mitraRateWoMaintenance?.toString() || "",
    mitraRateCanvasing: mitra.mitraRateCanvasing?.toString() || "",
    minWithdrawal: mitra.minWithdrawal?.toString() || "",
    bankName: mitra.bankName || "",
    bankAccountNo: mitra.bankAccountNo || "",
    bankAccountName: mitra.bankAccountName || "",
    targetHarian: mitra.targetHarian?.toString() || "",
    garansiHari: mitra.garansiHari?.toString() || "",
    slaGaransiJam: mitra.slaGaransiJam?.toString() || "",
    penaltyPsb: mitra.penaltyPsb?.toString() || "",
    penaltyMaintenance: mitra.penaltyMaintenance?.toString() || "",
    mitraRateFeePelanggan: mitra.mitraRateFeePelanggan?.toString() || "",
    enableFeePelanggan: mitra.enableFeePelanggan || false,
    mixradiusOwnerNames: mitra.mixradiusOwnerNames ?? [],
    nik: mitra.nik || "",
    tempatLahir: mitra.tempatLahir || "",
    tanggalLahir: mitra.tanggalLahir
      ? new Date(mitra.tanggalLahir).toISOString().split("T")[0] || ""
      : "",
    alamat: mitra.alamat || "",
    latitudeRumah: mitra.latitudeRumah?.toString() || "",
    longitudeRumah: mitra.longitudeRumah?.toString() || "",
    fotoDiri: mitra.fotoDiri || "",
    fotoKtp: mitra.fotoKtp || "",
    fotoSim: mitra.fotoSim || "",
    fotoKk: mitra.fotoKk || "",
  };
}
