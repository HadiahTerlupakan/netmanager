import { describe, expect, it } from "vitest";

import {
  mapMixRadiusOdpItem,
  parseMixRadiusOdpCustomersHtml,
} from "@/modules/integrations/services/mixradius-topology-client";

describe("mixradius topology parsing", () => {
  it("maps valid ODP items and normalizes positive Indonesian latitude", () => {
    const result = mapMixRadiusOdpItem({
      id: 1,
      odp_name: "ODP Timur",
      odp_area: "Area Timur",
      odp_latitude: "6.2",
      odp_longitude: "106.8",
      owner_name: "Owner A",
      customers_count: "2",
    });

    expect(result).toEqual({
      id: "1",
      name: "ODP Timur",
      area: "Area Timur",
      latitude: -6.2,
      longitude: 106.8,
      ownerName: "Owner A",
      customerCount: 2,
    });
  });

  it("parses ODP customers from the MixRadius edit page", () => {
    const html = `
      <input name="name" value="ODP Timur" />
      <table id="dynamic-table">
        <tr><th>No</th></tr>
        <tr>
          <td><input value="123" /></td>
          <td>MBR-001</td>
          <td><strong>Budi</strong></td>
          <td>Jl. Mawar</td>
          <td>20 Mbps</td>
          <td>Owner A</td>
          <td><a href="https://www.google.com/maps/place/6.2,106.8">Map</a></td>
        </tr>
      </table>`;

    const result = parseMixRadiusOdpCustomersHtml(html, "odp-1");

    expect(result).toEqual([
      {
        id: "123",
        memberId: "MBR-001",
        fullname: "Budi",
        address: "Jl. Mawar",
        planName: "20 Mbps",
        ownerName: "Owner A",
        odpId: "odp-1",
        odpName: "ODP Timur",
        latitude: -6.2,
        longitude: 106.8,
      },
    ]);
  });
});
