import { resolve } from "node:dns/promises";
import { logger } from "@/lib/logger";

const CNAME_TARGET = "radpro.id";

export class DnsVerificationService {
  /** Verify that a domain has a CNAME record pointing to radpro.id. */
  async verifyCname(domain: string): Promise<boolean> {
    try {
      const records = await resolve(domain, "CNAME");
      return records.some(
        (record) => record.replace(/\.$/, "").toLowerCase() === CNAME_TARGET,
      );
    } catch (error) {
      logger.warn(`[DnsVerification] Failed to resolve ${domain}:`, error);
      return false;
    }
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
