import type { CreateMapNodeDTO } from "../dto/MapDTO";
import type { IMappingRepository } from "../domain/ports/IMappingRepository";
import type { TenantContext } from "../utils/tenantContext";
import type { SyncMapDataInput } from "../types/MappingRepositoryTypes";
import { ValidationError } from "@/lib/errors";
import { MappingService } from "./MappingService";

export interface UserPasswordVerifier {
  verifyUserPassword(email: string, password: string): Promise<boolean>;
}

export class MappingAdminService {
  constructor(
    private readonly repository: IMappingRepository,
    private readonly mappingService: MappingService,
    private readonly userPasswordVerifier: UserPasswordVerifier,
  ) {}

  async verifyResetPassword(email: string, password: string): Promise<boolean> {
    return this.userPasswordVerifier.verifyUserPassword(email, password);
  }

  /**
   * Mengosongkan seluruh topologi NYATA milik tenant.
   *
   * Ditolak selama masih ada jalur rencana yang menempel di node nyata. Tanpa
   * penjaga ini permintaannya tetap gagal — FK `source`/`target` ber-`ON
   * DELETE RESTRICT` — tapi gagal sebagai galat Prisma yang diterjemahkan
   * menjadi 500 "Terjadi kesalahan pada server". Operator tidak punya cara
   * membedakan reset yang terhalang rencana dari server yang rusak, dan
   * monitoring error menyala tanpa sebab.
   *
   * Reset memang penghapusan yang diminta, jadi node terbit milik sebuah
   * planning akan ikut terhapus dan foto surveinya terlepas (`SET NULL`,
   * bukan `CASCADE` — buktinya bertahan). Yang dijaga di sini cuma satu: agar
   * penolakannya terbaca.
   */
  async resetAllMappingData(ctx: TenantContext): Promise<void> {
    const jalurRencanaMenempel =
      await this.repository.countPlannedEdgesOnRealNodes(ctx);

    if (jalurRencanaMenempel > 0) {
      throw new ValidationError(
        `Reset peta ditolak: ada ${jalurRencanaMenempel} jalur kabel rencana yang menempel di node nyata. Hapus jalur itu dari peta rencana OSP lebih dulu.`,
        { jumlahJalurRencana: jalurRencanaMenempel },
      );
    }

    await this.repository.resetAllMappingData(ctx);
  }

  async syncAllMappingData(
    ctx: TenantContext,
    data: SyncMapDataInput,
  ): Promise<void> {
    await this.repository.syncAllMappingData(ctx, data);
  }

  async createNode(ctx: TenantContext, data: CreateMapNodeDTO) {
    return this.mappingService.createNode(ctx, data);
  }
}
