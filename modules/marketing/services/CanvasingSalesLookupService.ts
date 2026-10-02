import { CanvasingSalesLookupRepository } from "../repositories/CanvasingSalesLookupRepository";

let canvasingSalesLookup: CanvasingSalesLookupRepository | null = null;

/** Sales canvasing APPROVED dengan nomor HP sama (public API untuk modul pelanggan). */
export function cariSalesCanvasingDariTelepon(tenantId: string, noTelp: string): Promise<string[]> {
  canvasingSalesLookup ??= new CanvasingSalesLookupRepository();
  return canvasingSalesLookup.cariSalesDariTelepon(tenantId, noTelp);
}
