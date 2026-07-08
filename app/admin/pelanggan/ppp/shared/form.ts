export type PppClientFormMode = "create" | "edit";

export type PppClientFormCoreFields = {
  idPelanggan: string;
  nama: string;
  username: string;
  password: string;
  passwordLogin: string;
  hargaPaketId: string;
  tanggalAktif: string;
  jatuhTempo: string;
  resellerId?: string;
  resellerOutletId?: string;
  siteId?: string;
};

export type PppClientFilePayload = {
  fileKTP: File | null;
  fileRumahSekitar: File | null;
  fileBAST: File | null;
};

type PppIdExistsResponse = {
  exists?: unknown;
  data?: {
    exists?: unknown;
  };
};

export function validatePppClientForm(
  formData: PppClientFormCoreFields,
  options: {
    mode: PppClientFormMode;
    idPelangganError: string | null;
  },
): string | null {
  if (!formData.idPelanggan.trim()) return "ID Pelanggan harus diisi";
  if (!/^\d{8}$/.test(formData.idPelanggan.trim()))
    return "ID Pelanggan harus 8 digit angka";
  if (options.idPelangganError) return options.idPelangganError;
  if (!formData.nama.trim()) return "Nama pelanggan harus diisi";
  if (!formData.username.trim()) return "Username PPPoE harus diisi";
  if (!formData.password.trim()) return "Password PPPoE harus diisi";
  if (!formData.passwordLogin.trim())
    return "Password Login Portal harus diisi";
  if (options.mode === "create" && !formData.siteId)
    return "Site harus dipilih";
  if (!formData.hargaPaketId) return "Harga Paket harus dipilih";
  return null;
}

export function buildPppClientFormData<T extends Record<string, unknown>>(
  payload: T,
  files: PppClientFilePayload,
): FormData {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }

    if (typeof value === "number") {
      formData.append(key, value.toString());
      return;
    }

    if (typeof value === "boolean") {
      formData.append(key, value ? "true" : "false");
      return;
    }

    if (typeof value === "object" && !(value instanceof File)) {
      formData.append(key, JSON.stringify(value));
      return;
    }

    formData.append(key, value as string | Blob);
  });

  if (files.fileKTP) formData.append("fileKTP", files.fileKTP);
  if (files.fileRumahSekitar)
    formData.append("fileRumahSekitar", files.fileRumahSekitar);
  if (files.fileBAST) formData.append("fileBAST", files.fileBAST);

  return formData;
}

export async function checkPppIdExists(idPelanggan: string): Promise<boolean> {
  if (!idPelanggan.trim()) {
    return false;
  }

  const res = await fetch(
    `/api/pelanggan-ppp/check-id?idPelanggan=${encodeURIComponent(idPelanggan)}`,
  );
  if (!res.ok) {
    return false;
  }

  const parsed = (await res.json()) as PppIdExistsResponse;
  const exists = parsed.data?.exists ?? parsed.exists;
  return exists === true;
}

export function applyPppClientFieldChange<
  T extends PppClientFormCoreFields,
>(params: {
  prev: T;
  name: string;
  value: string;
  checked: boolean;
  type: string;
  calculateJatuhTempo: (
    tanggalAktif: string | undefined,
    hargaPaketId: string | undefined,
  ) => string;
}): {
  updated: T;
  shouldMarkManualDueDate: boolean;
  shouldResetManualDueDate: boolean;
  shouldResetIdError: boolean;
} {
  const nextValue = params.type === "checkbox" ? params.checked : params.value;
  const updated = { ...params.prev, [params.name]: nextValue } as T;

  let shouldMarkManualDueDate = false;
  let shouldResetManualDueDate = false;
  let shouldResetIdError = false;

  if (params.name === "jatuhTempo") {
    shouldMarkManualDueDate = true;
  }

  if (params.name === "tanggalAktif" || params.name === "hargaPaketId") {
    shouldResetManualDueDate = true;
    updated.jatuhTempo = params.calculateJatuhTempo(
      params.name === "tanggalAktif" ? params.value : updated.tanggalAktif,
      params.name === "hargaPaketId" ? params.value : updated.hargaPaketId,
    );
  }

  if (params.name === "idPelanggan") {
    if (params.prev.username === params.prev.idPelanggan) {
      updated.username = params.value;
    }
    shouldResetIdError = true;
  }

  if (params.name === "resellerId") {
    updated.resellerOutletId = "";
  }

  return {
    updated,
    shouldMarkManualDueDate,
    shouldResetManualDueDate,
    shouldResetIdError,
  };
}
