import { describe, expect, it } from "vitest";

import { readMixRadiusSearchResponse } from "../../../../../app/admin/workorders/new/mixradius-search";

describe("readMixRadiusSearchResponse", () => {
  it("throws a readable config error when backend returns non-200 MixRadius config failure", async () => {
    const response = {
      ok: false,
      json: async () => ({
        success: false,
        error: "URL MixRadius tidak valid atau belum dikonfigurasi.",
        code: "MIXRADIUS_CONFIG_ERROR",
        details: { isConfigError: true },
      }),
    };

    await expect(readMixRadiusSearchResponse(response)).rejects.toThrow(
      "URL MixRadius tidak valid atau belum dikonfigurasi.",
    );
  });

  it("throws a readable config error when legacy success payload still contains isConfigError", async () => {
    const response = {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          error: "Integrasi MixRadius belum dikonfigurasi",
          isConfigError: true,
          data: [] as Array<{
            id: string;
            member_id: string;
            fullname: string;
            address: string;
            phonenumber: string;
            plan_name: string;
            remote_address: string;
            username: string;
          }>,
        },
      }),
    };

    await expect(readMixRadiusSearchResponse(response)).rejects.toThrow(
      "Integrasi MixRadius belum dikonfigurasi",
    );
  });

  it("returns customers when payload is valid", async () => {
    const customers = [
      {
        id: "cust-1",
        member_id: "MEM-1",
        fullname: "Yudi",
        address: "Jl. Mawar",
        phonenumber: "08123",
        plan_name: "10 Mbps",
        remote_address: "10.0.0.1",
        username: "yudi",
      },
    ];

    const response = {
      ok: true,
      json: async () => ({
        success: true,
        data: {
          data: customers,
        },
      }),
    };

    await expect(readMixRadiusSearchResponse(response)).resolves.toEqual(
      customers,
    );
  });
});
