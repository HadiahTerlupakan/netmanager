import { prismaRadius } from "@/lib/prisma-radius";
import { logger } from "@/lib/logger";
import type {
  AccelPppServerCreateData,
  AccelPppServerEntity,
  AccelPppServerFilters,
  AccelPppServerUpdateData,
} from "../../domain/entities/AccelPppServerEntity";
import type { IAccelPppServerRepository } from "../../domain/ports/IAccelPppServerRepository";
import { RadiusNasRepository } from "../../repositories/RadiusNasRepository";
import { AccelPppServerRepository } from "../../repositories/AccelPppServerRepository";
import {
  AccelPppCliCommandError,
  AccelPppRadiusNasSyncError,
  AccelPppServerNotFoundError,
  AccelPppSessionNotFoundError,
} from "../../domain/errors/AccelPppErrors";
import { AccelPppCliClient } from "./AccelPppCliClient";
import type { AccelPppSessionDTO, AccelPppStatDTO } from "./parsers";

export interface KickResult {
  terminated: boolean;
  notFound: boolean;
  message: string;
}

export interface AccelPppCliClientFactory {
  (server: AccelPppServerEntity): AccelPppCliClient;
}

const defaultCliClientFactory: AccelPppCliClientFactory = (server) =>
  new AccelPppCliClient({
    host: server.cliHost,
    port: server.cliPort,
    password: server.cliPassword,
  });

/**
 * Orkestrasi CRUD + operasi runtime accel-ppp server.
 *
 * Why: route handler tidak boleh mengandung business logic. Service ini
 * jadi titik tengah antara repository (Prisma + RADIUS NAS) dan klien CLI.
 *
 * Bedanya dari pola legacy MikroTik (yang swallow error NAS sync):
 *   - Sync `nas` row di FreeRADIUS DB dilakukan sebelum commit ke Prisma.
 *   - Kalau sync gagal → throw `AccelPppRadiusNasSyncError`, server tidak
 *     pernah masuk ke DB utama. Hasilnya: tidak ada server "yatim" di
 *     Prisma yang tidak punya pasangan NAS row di RADIUS.
 */
export class AccelPppServerService {
  constructor(
    private readonly serverRepo: IAccelPppServerRepository = new AccelPppServerRepository(),
    private readonly radiusNasRepo: RadiusNasRepository = new RadiusNasRepository(),
    private readonly radiusClient: typeof prismaRadius = prismaRadius,
    private readonly cliClientFactory: AccelPppCliClientFactory = defaultCliClientFactory,
  ) {}

  /** List server di tenant. */
  async list(
    tenantId: string | null,
    filters: AccelPppServerFilters = {},
  ): Promise<AccelPppServerEntity[]> {
    return this.serverRepo.findWithFilters(filters, tenantId);
  }

  /** Ambil satu server by id. Throw kalau tidak ada. */
  async getById(
    id: string,
    tenantId: string | null,
  ): Promise<AccelPppServerEntity> {
    const server = await this.serverRepo.findById(id, tenantId);
    if (!server) {
      throw new AccelPppServerNotFoundError(
        `Accel-PPP server ${id} tidak ditemukan`,
      );
    }
    return server;
  }

  /**
   * Create server + sync NAS row ke FreeRADIUS DB.
   * Sequence:
   *   1. Cek duplicate IP (di-handle repository.create lewat throw).
   *   2. Insert row Prisma (secrets di-encrypt di repository).
   *   3. Upsert nas row di RADIUS DB pakai *plaintext* radiusSecret dari input.
   *      Why: FreeRADIUS perlu secret plaintext untuk match shared-secret;
   *      yang di-encrypt hanya kolom di Prisma untuk at-rest protection.
   *   4. Kalau langkah 3 gagal → rollback (delete row Prisma) + throw.
   */
  async create(
    data: AccelPppServerCreateData,
    actorId: string,
  ): Promise<AccelPppServerEntity> {
    const server = await this.serverRepo.create(data);

    try {
      await this.upsertNasRow(server, data.radiusSecret);
    } catch (err) {
      // Rollback: hapus row Prisma supaya tidak ada server tanpa NAS pasangan.
      await this.safeDelete(server.id, server.tenantId, "create-rollback");
      throw new AccelPppRadiusNasSyncError(
        `Gagal sinkronisasi NAS ke RADIUS DB: ${(err as Error).message}`,
      );
    }

    logger.info("[accel-ppp] server created", {
      module: "network",
      service: "accel-ppp",
      action: "create",
      actorId,
      serverId: server.id,
      ipAddress: server.ipAddress,
      tenantId: server.tenantId,
    });

    return server;
  }

  /**
   * Update server. Kalau IP / nasIdentifier / radiusSecret / name berubah,
   * sync ulang nas row di RADIUS.
   */
  async update(
    id: string,
    data: AccelPppServerUpdateData,
    tenantId: string | null,
    actorId: string,
  ): Promise<AccelPppServerEntity> {
    const before = await this.getById(id, tenantId);
    await this.serverRepo.update(id, data, tenantId);
    const after = await this.getById(id, tenantId);

    if (this.shouldResyncNas(before, after, data)) {
      const secret = data.radiusSecret ?? after.radiusSecret;
      try {
        if (data.ipAddress && data.ipAddress !== before.ipAddress) {
          // Hapus baris lama supaya nasname unik tidak konflik.
          await this.deleteNasRow(before);
        }
        await this.upsertNasRow(after, secret);
      } catch (err) {
        throw new AccelPppRadiusNasSyncError(
          `Gagal sinkronisasi NAS saat update: ${(err as Error).message}`,
        );
      }
    }

    logger.info("[accel-ppp] server updated", {
      module: "network",
      service: "accel-ppp",
      action: "update",
      actorId,
      serverId: id,
      tenantId,
    });

    return after;
  }

  /**
   * Hapus server. Default: tolak kalau ada session aktif (radacct).
   * `force=true` bypass check itu — dipakai admin untuk pembersihan darurat.
   */
  async delete(
    id: string,
    tenantId: string | null,
    actorId: string,
    options: { force?: boolean } = {},
  ): Promise<void> {
    const server = await this.getById(id, tenantId);

    if (!options.force) {
      const activeCount = await this.countActiveSessionsForServer(server);
      if (activeCount > 0) {
        throw new AccelPppCliCommandError(
          `Server masih punya ${activeCount} sesi aktif. Pakai force=true untuk paksa hapus.`,
        );
      }
    }

    try {
      await this.deleteNasRow(server);
    } catch (err) {
      logger.warn("[accel-ppp] gagal hapus NAS row, tetap lanjut", {
        serverId: id,
        error: (err as Error).message,
      });
    }

    await this.serverRepo.delete(id, tenantId);

    logger.info("[accel-ppp] server deleted", {
      module: "network",
      service: "accel-ppp",
      action: "delete",
      actorId,
      serverId: id,
      tenantId,
      force: Boolean(options.force),
    });
  }

  /** Cek koneksi CLI cepat — tidak menyentuh DB. */
  async testConnection(
    id: string,
    tenantId: string | null,
  ): Promise<{ ok: boolean; raw: string }> {
    const server = await this.getById(id, tenantId);
    const cli = this.cliClientFactory(server);
    const raw = await cli.ping();
    return { ok: true, raw };
  }

  /** Ambil daftar sesi live dari accel-ppp. */
  async getLiveSessions(
    id: string,
    tenantId: string | null,
  ): Promise<AccelPppSessionDTO[]> {
    const server = await this.getById(id, tenantId);
    const cli = this.cliClientFactory(server);
    return cli.showSessions();
  }

  /** Ambil agregat statistik runtime accel-ppp. */
  async getStat(id: string, tenantId: string | null): Promise<AccelPppStatDTO> {
    const server = await this.getById(id, tenantId);
    const cli = this.cliClientFactory(server);
    return cli.showStat();
  }

  /**
   * Putuskan sesi aktif by username.
   * Throw `AccelPppSessionNotFoundError` jika username tidak sedang aktif —
   * supaya layer API bisa map ke 404.
   */
  async kickSession(
    id: string,
    username: string,
    tenantId: string | null,
    actorId: string,
  ): Promise<KickResult> {
    const server = await this.getById(id, tenantId);
    const cli = this.cliClientFactory(server);
    const result = await cli.terminateByUsername(username);

    logger.info("[accel-ppp] session kicked", {
      module: "network",
      service: "accel-ppp",
      action: "kick",
      actorId,
      serverId: id,
      tenantId,
      targetUsername: username,
      terminated: result.terminated,
      notFound: result.notFound,
    });

    if (result.notFound) {
      throw new AccelPppSessionNotFoundError(
        `Sesi untuk username ${username} tidak ditemukan di server`,
      );
    }

    return result;
  }

  private async upsertNasRow(
    server: AccelPppServerEntity,
    plaintextSecret: string,
  ): Promise<void> {
    if (!server.tenantId) {
      // NAS multi-tenant butuh tenantId; tanpa itu kita tidak bisa create
      // baris yang bisa di-match di RADIUS request handler.
      throw new Error("tenantId wajib untuk sync NAS row");
    }

    await this.radiusNasRepo.createNas(
      {
        nasname: server.ipAddress,
        shortname: server.name.slice(0, 32),
        type: "other",
        ports: server.authPort,
        secret: plaintextSecret,
        community: null,
        description: server.description ?? `accel-ppp: ${server.name}`,
      },
      server.tenantId,
    );
  }

  private async deleteNasRow(server: AccelPppServerEntity): Promise<void> {
    if (!server.tenantId) return;
    const existing = await this.radiusNasRepo.getNasByIp(
      server.ipAddress,
      server.tenantId,
    );
    if (!existing?.id) return;
    await this.radiusNasRepo.deleteNas(existing.id, server.tenantId);
  }

  private shouldResyncNas(
    before: AccelPppServerEntity,
    after: AccelPppServerEntity,
    data: AccelPppServerUpdateData,
  ): boolean {
    return Boolean(
      (data.ipAddress && data.ipAddress !== before.ipAddress) ||
      (data.radiusSecret && data.radiusSecret !== before.radiusSecret) ||
      (data.name && data.name !== before.name) ||
      (data.authPort && data.authPort !== before.authPort) ||
      after.description !== before.description,
    );
  }

  private async countActiveSessionsForServer(
    server: AccelPppServerEntity,
  ): Promise<number> {
    return this.radiusClient.radacct.count({
      where: {
        acctstoptime: null,
        nasipaddress: server.ipAddress,
        ...(server.tenantId ? { tenantId: server.tenantId } : {}),
      },
    });
  }

  private async safeDelete(
    id: string,
    tenantId: string | null,
    reason: string,
  ): Promise<void> {
    try {
      await this.serverRepo.delete(id, tenantId);
    } catch (err) {
      logger.error(`[accel-ppp] safeDelete (${reason}) gagal`, {
        serverId: id,
        error: (err as Error).message,
      });
    }
  }
}
