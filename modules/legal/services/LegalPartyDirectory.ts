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
  detailUrl: string | null;
}

interface PartySource {
  search(keyword: string, limit: number): Promise<PartyOption[]>;
  findById(id: string): Promise<PartyOption | null>;
}

const joinParts = (...parts: Array<string | null | undefined>) =>
  parts.filter(Boolean).join(" · ") || null;

function option(
  type: LegalPartyType,
  record: { id: string; name: string; description: string | null },
): PartyOption {
  return { type, ...record, detailUrl: partyDetailUrl(type, record.id) };
}

const mitraSource: PartySource = {
  async search(keyword, limit) {
    const mitras = await getMitraLookupService().searchForPicker(keyword, limit);
    return mitras.map((mitra) =>
      option("MITRA", { id: mitra.id, name: mitra.name ?? mitra.email, description: joinParts(mitra.phone, mitra.email) }),
    );
  },
  async findById(id) {
    const mitra = await getMitraLookupService().findById(id);
    return mitra
      ? option("MITRA", { id: mitra.id, name: mitra.name ?? mitra.email, description: joinParts(mitra.phone, mitra.email) })
      : null;
  },
};

const resellerSource: PartySource = {
  async search(keyword, limit) {
    const { tenantId } = await getTenantIdFromContext();
    const result = await getResellerService().listResellers({ tenantId, search: keyword, limit });
    return result.items.map((reseller) =>
      option("RESELLER", { id: reseller.id, name: reseller.name, description: joinParts(reseller.code, reseller.address) }),
    );
  },
  async findById(id) {
    const { tenantId } = await getTenantIdFromContext();
    const reseller = await getResellerService().getResellerById(tenantId, id);
    return reseller
      ? option("RESELLER", { id: reseller.id, name: reseller.name, description: joinParts(reseller.code, reseller.address) })
      : null;
  },
};

const pelangganSource: PartySource = {
  async search(keyword, limit) {
    const result = await getPelangganService().getAllPelangganPaginated({ search: keyword }, 1, limit);
    return result.data.map((pelanggan) =>
      option("PELANGGAN", { id: pelanggan.id, name: pelanggan.nama, description: joinParts(pelanggan.idPelanggan, pelanggan.alamat) }),
    );
  },
  async findById(id) {
    const pelanggan = await getPelangganService().getPelanggan(id);
    return pelanggan
      ? option("PELANGGAN", { id: pelanggan.id, name: pelanggan.nama, description: joinParts(pelanggan.idPelanggan, pelanggan.alamat) })
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
      option("VENDOR", { id: supplier.id, name: supplier.name, description: joinParts(supplier.code, supplier.address) }),
    );
  },
  async findById(id) {
    const supplier = await findSupplierOrNull(id);
    return supplier
      ? option("VENDOR", { id: supplier.id, name: supplier.name, description: joinParts(supplier.code, supplier.address) })
      : null;
  },
};

const siteSource: PartySource = {
  async search(keyword, limit) {
    const result = await new SiteService().getSites({ search: keyword || undefined, activeOnly: true });
    return (result.success ? result.data : [])
      .slice(0, limit)
      .map((site) => option("SITE", { id: site.id, name: site.name, description: joinParts(site.code, site.address) }));
  },
  async findById(id) {
    const result = await new SiteService().getSiteById(id);
    return result.success
      ? option("SITE", { id: result.data.id, name: result.data.name, description: joinParts(result.data.code, result.data.address) })
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
