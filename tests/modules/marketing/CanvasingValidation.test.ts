import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
  parseCanvasingStatusParam,
  parseCreateCanvasingInput,
  parseUpdateCanvasingInput,
} from "@/modules/marketing/validators/canvasingValidation";

describe("canvasingValidation", () => {
  it("menolak payload create ketika paket kosong", () => {
    expect(() =>
      parseCreateCanvasingInput({
        nama: "Budi",
        noKtp: "1234567890123456",
        noTelpon: "08123456789",
        alamat: "Jl. Mawar 1",
        paket: "",
        kabel: 10,
      }),
    ).toThrowError(ZodError);
  });

  it("menolak payload create ketika kabel nol", () => {
    expect(() =>
      parseCreateCanvasingInput({
        nama: "Budi",
        noKtp: "1234567890123456",
        noTelpon: "08123456789",
        alamat: "Jl. Mawar 1",
        paket: "HOME_10MBPS",
        kabel: 0,
      }),
    ).toThrowError(ZodError);
  });

  it("menolak payload create ketika paket tidak ada di opsi UI", () => {
    expect(() =>
      parseCreateCanvasingInput({
        nama: "Budi",
        noKtp: "1234567890123456",
        noTelpon: "08123456789",
        alamat: "Jl. Mawar 1",
        paket: "BIZ_200MBPS",
        kabel: 20,
      }),
    ).toThrowError(ZodError);
  });

  it("mengubah string kosong opsional menjadi null saat create", () => {
    const result = parseCreateCanvasingInput({
      nama: "Budi",
      noKtp: "1234567890123456",
      noTelpon: "08123456789",
      alamat: "Jl. Mawar 1",
      paket: "HOME_10MBPS",
      kabel: 20,
      email: "   ",
      odp: "",
      sn: " ",
    });

    expect(result.email).toBeNull();
    expect(result.odp).toBeNull();
    expect(result.sn).toBeNull();
  });

  it("menolak payload update generic ketika membawa status", () => {
    try {
      parseUpdateCanvasingInput({
        status: "REJECTED",
        email: "",
      });
      throw new Error("Expected parseUpdateCanvasingInput to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      expect(error).toMatchObject({
        issues: [
          expect.objectContaining({
            path: ["status"],
            message: GENERIC_STATUS_UPDATE_FORBIDDEN_MESSAGE,
          }),
        ],
      });
    }
  });

  it("menolak payload update ketika paket tidak ada di opsi UI", () => {
    expect(() =>
      parseUpdateCanvasingInput({
        paket: "BIZ_200MBPS",
      }),
    ).toThrowError(ZodError);
  });

  it("mengembalikan status valid dari query param", () => {
    expect(parseCanvasingStatusParam("APPROVED")).toBe("APPROVED");
    expect(parseCanvasingStatusParam(null)).toBeUndefined();
  });

  it("menolak status query invalid", () => {
    expect(() => parseCanvasingStatusParam("DONE")).toThrowError(ZodError);
  });
});
