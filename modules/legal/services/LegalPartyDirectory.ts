import { getTenantIdFromContext } from "@/lib/tenant-context";
import { getMitraLookupService } from "@/modules/mitra";
import { getPelangganService } from "@/modules/pelanggan";
import { getSupplierService, SupplierNotFoundError } from "@/modules/procurement";
import { getResellerService } from "@/modules/reseller";
import { SiteService } from "@/modules/roles";
import type { LegalPartyType } from "../domain/entities/LegalDocument";
import { partyDetailUrl } from "../domain/party-links";

/**
 * Pihak kontrak dari modul lain: mitra, reseller, pelanggan, vendor, site.
 *
 * Mitra tinggal di database terpisah, jadi tidak ada foreign key; dokumen
 * legal menyimpan jenis + id + salinan nama, dan keberadaannya diperiksa lewat
 * API publik tiap modul. Isolasi tenant ditegakkan oleh layanan masing-masing.
 */

export interface PartyOption {
  type: LegalPartyType;
  id: string;
  name: string;
  /** Keterangan pembeda di pemilih: kode, alamat, atau telepon. */
  description: string | null;
  /** Alamat & telepon untuk isian template {{pihak.alamat}} / {{pihak.telepon}}. */
  address: string | null;
  phone: string | null;
  detailUrl: string | null;
}

interface PartySource {
  search(keyword: string, limit: number): Promise<PartyOption[]>;
  findById(id: string): Promise<PartyOption | null>;
}

const joinParts = (...parts: Array<string | null | undefined>) =>
  parts.filter(Boolean).join(" · ") || null;

interface PartyRecord {
  id: string;
  name: string;
  description: string | null;
  address?: string | null;
  phone?: string | null;
}

function option(type: LegalPartyType, record: PartyRecord): PartyOption {
  return {
    type,
    id: record.id,
    name: record.name,
    description: record.description,
    address: record.address ?? null,
    phone: record.phone ?? null,
    detailUrl: partyDetailUrl(type, record.id),
  };
}

type MitraRecord = { id: string; name: string | null; email: string; phone: string | null };
const mitraOption = (mitra: MitraRecord) =>
  option("MITRA", { id: mitra.id, name: mitra.name ?? mitra.email, description: joinParts(mitra.phone, mitra.email), phone: mitra.phone });

type CodedRecord = { id: string; name: string; code: string | null; address?: string | null; phone?: string | null };
const codedOption = (type: LegalPartyType, record: CodedRecord) =>
  option(type, { ...record, description: joinParts(record.code, record.address) });

type PelangganRecord = { id: string; nama: string; idPelanggan: string | null; alamat: string | null; noTelp?: string | null };
const pelangganOption = (pelanggan: PelangganRecord) =>
  option("PELANGGAN", {
    id: pelanggan.id,
    name: pelanggan.nama,
    description: joinParts(pelanggan.idPelanggan, pelanggan.alamat),
    address: pelanggan.alamat,
    phone: pelanggan.noTelp,
  });

const mitraSource: PartySource = {
  async search(keyword, limit) {
    const mitras = await getMitraLookupService().searchForPicker(keyword, limit);
    return mitras.map((mitra) =>
      mitraOption(mitra),
    );
  },
  async findById(id) {
    const mitra = await getMitraLookupService().findById(id);
    return mitra
      ? mitraOption(mitra)
      : null;
  },
};

const resellerSource: PartySource = {
  async search(keyword, limit) {
    const { tenantId } = await getTenantIdFromContext();
    const result = await getResellerService().listResellers({ tenantId, search: keyword, limit });
    return result.items.map((reseller) =>
      codedOption("RESELLER", reseller),
    );
  },
  async findById(id) {
    const { tenantId } = await getTenantIdFromContext();
    const reseller = await getResellerService().getResellerById(tenantId, id);
    return reseller
      ? codedOption("RESELLER", reseller)
      : null;
  },
};

const pelangganSource: PartySource = {
  async search(keyword, limit) {
    const result = await getPelangganService().getAllPelangganPaginated({ search: keyword }, 1, limit);
    return result.data.map((pelanggan) =>
      pelangganOption(pelanggan),
    );
  },
  async findById(id) {
    const pelanggan = await getPelangganService().getPelanggan(id);
    return pelanggan
      ? pelangganOption(pelanggan)
      : null;
  },
};

/**
 * getById melempar bila vendor tidak ada; di sini "tidak ada" cukup null.
 * Galat lain (mis. database) tetap diteruskan, jangan disamarkan jadi "tidak ada".
 */
async function findSupplierOrNull(id: string) {
  try {
    return await getSupplierService().getById(id);
  } catch (error) {
    if (error instanceof SupplierNotFoundError) return null;
    throw error;
  }
}

const vendorSource: PartySource = {
  async search(keyword, limit) {
    const { tenantId } = await getTenantIdFromContext();
    const result = await getSupplierService().list({ tenantId, search: keyword, page: 1, limit });
    return result.items.map((supplier) =>
      codedOption("VENDOR", supplier),
    );
  },
  async findById(id) {
    const supplier = await findSupplierOrNull(id);
    return supplier
      ? codedOption("VENDOR", supplier)
      : null;
  },
};

const siteSource: PartySource = {
  async search(keyword, limit) {
    const result = await new SiteService().getSites({ search: keyword || undefined, activeOnly: true });
    return (result.success ? result.data : [])
      .slice(0, limit)
      .map((site) => codedOption("SITE", site));
  },
  async findById(id) {
    const result = await new SiteService().getSiteById(id);
    return result.success
      ? codedOption("SITE", result.data)
      : null;
  },
};

const SOURCES: Record<LegalPartyType, PartySource> = {
  MITRA: mitraSource,
  RESELLER: resellerSource,
  PELANGGAN: pelangganSource,
  VENDOR: vendorSource,
  SITE: siteSource,
};

/** Pencarian dan pemeriksaan pihak kontrak lintas modul. */
export class LegalPartyDirectory {
  /** Cari pihak satu jenis berdasarkan kata kunci. */
  search(type: LegalPartyType, keyword: string, limit: number): Promise<PartyOption[]> {
    return SOURCES[type].search(keyword.trim(), limit);
  }

  /** Satu pihak berdasarkan id; null bila tidak ada atau milik tenant lain. */
  findById(type: LegalPartyType, id: string): Promise<PartyOption | null> {
    return SOURCES[type].findById(id);
  }
}
