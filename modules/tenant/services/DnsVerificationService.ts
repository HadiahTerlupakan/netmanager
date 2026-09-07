import { resolve } from "node:dns/promises";
import { logger } from "@/lib/logger";

/**
 * Pemeriksaan DNS untuk domain kustom tenant.
 *
 * Ada dua cara yang sah untuk mengarahkan domain ke kita, dan pilihannya
 * ditentukan DNS, bukan selera: CNAME tidak boleh dipasang di apex sebuah zona
 * (RFC 1034), sehingga tenant yang ingin memakai `domainklien.com` langsung
 * hanya bisa memakai A record. Menerima CNAME saja berarti domain apex tidak
 * akan pernah lolos verifikasi.
 */

const DEFAULT_BASE_DOMAIN = "radpro.id";

function getBaseDomain(): string {
  return (process.env.DOMAIN || DEFAULT_BASE_DOMAIN).toLowerCase();
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/\.$/, "").toLowerCase();
}

export class DnsVerificationService {
  /** Verify that a domain has a CNAME record pointing to the base domain. */
  async verifyCname(domain: string): Promise<boolean> {
    try {
      const records = await resolve(domain, "CNAME");
      return records.some(
        (record) => normalizeHostname(record) === getBaseDomain(),
      );
    } catch (error) {
      logger.warn(
        `[DnsVerification] Failed to resolve CNAME ${domain}:`,
        error,
      );
      return false;
    }
  }

  /**
   * Verify that a domain resolves to at least one of our own IP addresses.
   *
   * Dipakai untuk domain apex yang tidak bisa memakai CNAME. Perbandingan
   * dilakukan terhadap A record domain utama supaya perpindahan IP server
   * tidak perlu diikuti perubahan kode.
   */
  async verifyARecord(domain: string): Promise<boolean> {
    try {
      const [domainAddresses, baseAddresses] = await Promise.all([
        resolve(domain, "A"),
        resolve(getBaseDomain(), "A"),
      ]);

      const ours = new Set(baseAddresses);
      return domainAddresses.some((address) => ours.has(address));
    } catch (error) {
      logger.warn(`[DnsVerification] Failed to resolve A ${domain}:`, error);
      return false;
    }
  }

  /** Apakah domain ini sudah diarahkan ke kita, lewat CNAME maupun A record? */
  async verifyPointsToUs(domain: string): Promise<boolean> {
    if (await this.verifyCname(domain)) return true;

    return this.verifyARecord(domain);
  }

  /** Check that a domain resolves to at least one A record. */
  async resolvesDomain(domain: string): Promise<boolean> {
    try {
      const addresses = await resolve(domain, "A");
      return addresses.length > 0;
    } catch {
      return false;
    }
  }
}
