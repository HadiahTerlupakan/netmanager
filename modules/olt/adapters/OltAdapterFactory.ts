import type { OltVendor } from "../domain/entities/olt-device.entity";
import type { IOltAdapter } from "../domain/ports/IOltAdapter";
import { OltErrors } from "../domain/errors/olt-errors";
import { ZteAdapter } from "./zte/ZteAdapter";
import { HsgqAdapter } from "./hsgq/HsgqAdapter";
import { HiosoAdapter } from "./hioso/HiosoAdapter";
import { CDataAdapter } from "./cdata/CDataAdapter";

export class OltAdapterFactory {
  private adapters = new Map<OltVendor, IOltAdapter>();

  constructor() {
    this.adapters.set("ZTE", new ZteAdapter());
    this.adapters.set("HSGQ", new HsgqAdapter());
    this.adapters.set("HIOSO", new HiosoAdapter());
    this.adapters.set("CDATA", new CDataAdapter());
  }

  getAdapter(vendor: OltVendor): IOltAdapter {
    const adapter = this.adapters.get(vendor);
    if (!adapter) {
      throw OltErrors.unsupportedVendor(vendor);
    }
    return adapter;
  }
}
