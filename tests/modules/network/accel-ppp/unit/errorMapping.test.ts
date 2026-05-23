import { describe, expect, it } from "vitest";
import { mapAccelPppErrorToResponse } from "@/app/api/admin/accel-ppp-servers/_helpers";
import {
  AccelPppCliCommandError,
  AccelPppCliConnectionError,
  AccelPppCliTimeoutError,
  AccelPppDuplicateIpError,
  AccelPppRadiusNasSyncError,
  AccelPppServerNotFoundError,
  AccelPppSessionNotFoundError,
  FullRadiusModeDisabledError,
} from "@/modules/network/domain/errors/AccelPppErrors";

describe("mapAccelPppErrorToResponse", () => {
  it("FullRadiusModeDisabledError → 403", async () => {
    const res = mapAccelPppErrorToResponse(new FullRadiusModeDisabledError());
    expect(res?.status).toBe(403);
  });

  it("AccelPppServerNotFoundError → 404", async () => {
    const res = mapAccelPppErrorToResponse(new AccelPppServerNotFoundError());
    expect(res?.status).toBe(404);
  });

  it("AccelPppSessionNotFoundError → 404", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppSessionNotFoundError("ghost"),
    );
    expect(res?.status).toBe(404);
  });

  it("AccelPppDuplicateIpError → 409", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppDuplicateIpError("ip dup"),
    );
    expect(res?.status).toBe(409);
  });

  it("AccelPppCliCommandError mengandung 'sesi aktif' → 409", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppCliCommandError("Server masih punya 3 sesi aktif"),
    );
    expect(res?.status).toBe(409);
  });

  it("AccelPppCliCommandError generic → 503", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppCliCommandError("syntax error"),
    );
    expect(res?.status).toBe(503);
  });

  it("AccelPppCliConnectionError → 503", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppCliConnectionError("connect refused"),
    );
    expect(res?.status).toBe(503);
  });

  it("AccelPppCliTimeoutError → 504", async () => {
    const res = mapAccelPppErrorToResponse(new AccelPppCliTimeoutError());
    expect(res?.status).toBe(504);
  });

  it("AccelPppRadiusNasSyncError → 503", async () => {
    const res = mapAccelPppErrorToResponse(
      new AccelPppRadiusNasSyncError("radius down"),
    );
    expect(res?.status).toBe(503);
  });

  it("error tidak dikenal → null (caller harus rethrow)", async () => {
    const res = mapAccelPppErrorToResponse(new Error("random"));
    expect(res).toBeNull();
  });
});
