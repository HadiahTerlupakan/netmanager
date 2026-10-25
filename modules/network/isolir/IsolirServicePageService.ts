import { runAsSystemContext } from "@/lib/tenant-context";
import { IsolirPageRepository } from "./IsolirPageRepository";
import { resolveIsolirContent } from "./isolir-content";
import { renderIsolirPage, type IsolirRenderResult } from "./isolir-render";

/** Halaman isolir untuk layanan netmanager-isolir, dicari lewat alamat VPN router. */
export class IsolirServicePageService {
  /**
   * Renderer yang sama dengan mode router, jadi halaman identik di kedua mode.
   * Alamat tak dikenal tetap dilayani dengan isi default: pelanggan yang
   * terisolir harus melihat halaman, bukan galat.
   */
  getPage(address: string): Promise<IsolirRenderResult> {
    return runAsSystemContext(
      "isolir-service-page",
      async () => {
        const router =
          await IsolirPageRepository.findTenantIdByVpnAddress(address);
        const content = await resolveIsolirContent(router?.tenantId ?? null);
        return renderIsolirPage(content);
      },
      { silent: true },
    );
  }
}
