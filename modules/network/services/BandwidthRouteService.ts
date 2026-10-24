import { logger } from "@/lib/logger";
import { bandwidthSchema } from "@/lib/validations/bandwidth";
import { sanitizeInput } from "@/lib/utils/sanitize";
import { logActivitySafe } from "@/lib/logger";
import { checkSiteRestriction } from "@/modules/roles";
import { RadiusSyncService } from "./radius-sync-service";
import { RadiusRepository } from "../repositories/RadiusRepository";
import { BandwidthRepository } from "../repositories/BandwidthRepository";
import type { IBandwidthRepository } from "../domain/ports/IBandwidthRepository";
import type { IRadiusBandwidthSyncRepository } from "../domain/ports/IRadiusBandwidthSyncRepository";
import * as z from "zod";
import type { Session } from "next-auth";

const DEFAULT_STATUS = "AKTIF";
const MAX_PACKAGE_NAMES = 3;

interface BandwidthMutationInput {
  name?: string;
  maxLimitDownload?: string;
  maxLimitUpload?: string;
  burstLimitDownload?: string | null;
  burstLimitUpload?: string | null;
  minLimitDownload?: string | null;
  minLimitUpload?: string | null;
  burstThresholdDownload?: string | null;
  burstThresholdUpload?: string | null;
  burstTimeDownload?: number | null;
  burstTimeUpload?: number | null;
  priority?: number | null;
  description?: string;
  status?: string;
  siteId?: string | null;
}

/** Service untuk kebutuhan route bandwidth. */
export class BandwidthRouteService {
  constructor(
    private readonly repository: IBandwidthRepository = new BandwidthRepository(),
    private readonly radiusRepository: IRadiusBandwidthSyncRepository = new RadiusRepository(),
  ) {}

  /** Ambil daftar bandwidth sesuai filter dan pembatasan site. */
  getBandwidths(reqUrl: string, session: Session) {
    return this.repository.findMany(this.buildListFilters(reqUrl, session));
  }

  /** Buat bandwidth baru dari payload request. */
  async createBandwidth(body: Record<string, unknown>, session: Session) {
    const siteId = this.resolveSiteId(body.siteId, session);
    const payload = this.validatePayload(this.buildMutationInput(body, siteId));
    const bandwidth = await this.repository.create(this.toCreateInput(payload));
    this.logCreateActivity(bandwidth, session, siteId);
    return bandwidth;
  }

  /** Ambil detail bandwidth beserta relasinya. */
  getBandwidthById(id: string) {
    return this.repository.findById(id);
  }

  /** Perbarui bandwidth dan sinkronkan RADIUS bila perlu. */
  async updateBandwidth(id: string, body: Record<string, unknown>) {
    const payload = this.validatePayload(this.buildMutationInput(body));
    const bandwidth = await this.repository.update(id, payload);
    await this.syncBandwidthToRadius(id);
    return bandwidth;
  }

  /** Hapus bandwidth jika tidak sedang dipakai paket. */
  async deleteBandwidth(id: string) {
    const bandwidth = await this.repository.findForDelete(id);

    if (!bandwidth) {
      throw new Error("NOT_FOUND:Bandwidth");
    }

    this.ensureBandwidthDeletable(bandwidth);
    await this.repository.delete(id);
  }

  private buildListFilters(reqUrl: string, session: Session) {
    const { searchParams } = new URL(reqUrl);
    const status = searchParams.get("status") ?? undefined;
    const requestedSiteId = searchParams.get("siteId");
    const restriction = checkSiteRestriction(session, "bandwidth");

    if (restriction.isRestricted && restriction.siteIds.length > 0) {
      return { status, siteIds: restriction.siteIds, includeGlobal: true };
    }

    return { status, requestedSiteId, includeGlobal: true };
  }

  private resolveSiteId(rawSiteId: unknown, session: Session): string | null {
    const restriction = checkSiteRestriction(session, "bandwidth");
    if (restriction.isRestricted && restriction.primarySiteId) {
      return restriction.primarySiteId;
    }

    return typeof rawSiteId === "string" && rawSiteId ? rawSiteId : null;
  }

  private buildMutationInput(
    body: Record<string, unknown>,
    siteId?: string | null,
  ): BandwidthMutationInput {
    return {
      name: this.toSanitizedString(body.name),
      maxLimitDownload: this.toSanitizedString(body.maxLimitDownload),
      maxLimitUpload: this.toSanitizedString(body.maxLimitUpload),
      burstLimitDownload: this.toClearableString(body.burstLimitDownload),
      burstLimitUpload: this.toClearableString(body.burstLimitUpload),
      minLimitDownload: this.toClearableString(body.minLimitDownload),
      minLimitUpload: this.toClearableString(body.minLimitUpload),
      burstThresholdDownload: this.toClearableString(
        body.burstThresholdDownload,
      ),
      burstThresholdUpload: this.toClearableString(body.burstThresholdUpload),
      burstTimeDownload: this.toClearableNumber(body.burstTimeDownload),
      burstTimeUpload: this.toClearableNumber(body.burstTimeUpload),
      priority: this.toClearableNumber(body.priority),
      description: this.toSanitizedString(body.description),
      status: this.toStatus(body.status),
      ...(siteId !== undefined ? { siteId } : {}),
    };
  }

  private validatePayload(payload: BandwidthMutationInput) {
    const cleanedPayload = this.removeUndefinedValues(payload);
    const validation = bandwidthSchema.safeParse(cleanedPayload);
    if (validation.success) {
      return validation.data;
    }

    throw {
      code: "VALIDATION_ERROR",
      message: "Validasi gagal",
      details: { errors: z.flattenError(validation.error) },
    };
  }

  private removeUndefinedValues(payload: BandwidthMutationInput) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => value !== undefined),
    );
  }

  private toCreateInput(
    payload: z.infer<typeof bandwidthSchema>,
  ): z.infer<typeof bandwidthSchema> & { id: string; updatedAt: Date } {
    return { id: crypto.randomUUID(), updatedAt: new Date(), ...payload };
  }

  private async syncBandwidthToRadius(id: string): Promise<void> {
    try {
      const radiusSync = new RadiusSyncService();
      const mode = await radiusSync.getConnectionMode();
      if (mode !== "RADIUS") return;
      await this.radiusRepository.syncBandwidthToRadius(id);
    } catch (error) {
      logger.error("[BandwidthRouteService] RADIUS sync error:", error);
    }
  }

  private ensureBandwidthDeletable(bandwidth: {
    name: string;
    hargaPaket: Array<{ name: string }>;
  }) {
    if (bandwidth.hargaPaket.length === 0) {
      return;
    }

    const packageNames = bandwidth.hargaPaket
      .slice(0, MAX_PACKAGE_NAMES)
      .map((item) => item.name)
      .join(", ");
    const extraCount = bandwidth.hargaPaket.length - MAX_PACKAGE_NAMES;
    const suffix = extraCount > 0 ? ` dan ${extraCount} lainnya` : "";

    throw new Error(
      `CONFLICT:Bandwidth "${bandwidth.name}" tidak dapat dihapus karena masih digunakan oleh ${bandwidth.hargaPaket.length} paket (${packageNames}${suffix}). Hapus atau ubah bandwidth pada paket tersebut terlebih dahulu.`,
    );
  }

  private logCreateActivity(
    bandwidth: { id: string; name: string },
    session: Session,
    siteId: string | null,
  ) {
    const userId = session.user?.id;
    if (!userId) return;

    logActivitySafe({
      action: "CREATE",
      subject: "Bandwidth",
      userId,
      details: { id: bandwidth.id, name: bandwidth.name, siteId },
    });
  }

  private toSanitizedString(value: unknown): string | undefined {
    if (typeof value !== "string" || !value) {
      return undefined;
    }

    return sanitizeInput(value);
  }

  // Optional limits: an absent field keeps the stored value, null or an
  // empty string clears it, so a burst that was set can be removed again.
  private toClearableString(value: unknown): string | null | undefined {
    if (value === null || value === "") return null;
    return this.toSanitizedString(value);
  }

  private toClearableNumber(value: unknown): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null || value === "") return null;
    return Number(value);
  }

  private toStatus(value: unknown): string {
    return typeof value === "string" && value ? value : DEFAULT_STATUS;
  }
}
