import type { OdpEntity } from "../domain/entities/OdpEntity";
import type { IOdpRepository } from "../domain/ports/IOdpRepository";
import { OdpRepository } from "../repositories/OdpRepository";

interface OdpListItemDTO {
  id: string;
  name: string;
  location: string | null;
}

/** Service untuk kebutuhan route daftar ODP. */
export class OdpRouteService {
  constructor(
    private readonly repository: IOdpRepository = new OdpRepository(),
  ) {}

  /** Ambil daftar ODP ringkas sesuai filter site. */
  async getOdps(siteId?: string): Promise<{ odps: OdpListItemDTO[] }> {
    const odps = await this.repository.findAll(siteId);
    return { odps: odps.map((odp) => this.toListItem(odp)) };
  }

  private toListItem(
    odp: Pick<OdpEntity, "id" | "name" | "location">,
  ): OdpListItemDTO {
    return { id: odp.id, name: odp.name, location: odp.location };
  }
}
