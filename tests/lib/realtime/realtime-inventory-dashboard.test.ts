import { describe, expect, it } from "vitest";

import {
  useRealtimeEventMock,
  useRealtimeScopeMock,
} from "./realtime-boundary-test-setup";

describe("realtime inventory dashboard", () => {
  it("subscribes inventory barang table through the realtime scope and event boundaries", async () => {
    const { BarangTable } = await import("@/components/inventory/BarangTable");

    BarangTable();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "inventory",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "inventory.update",
      expect.any(Function),
    );
  });

  it("subscribes inventory stats through the realtime scope and event boundaries", async () => {
    const { StatsCards } = await import("@/components/inventory/StatsCards");

    StatsCards();

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "inventory",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "inventory.update",
      expect.any(Function),
    );
  });

  it("subscribes inventory masuk table through the realtime scope and event boundaries", async () => {
    const { MasukTable } = await import("@/components/inventory/MasukTable");

    MasukTable({});

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "inventory",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "inventory.update",
      expect.any(Function),
    );
  });

  it("subscribes inventory keluar table through the realtime scope and event boundaries", async () => {
    const { KeluarTable } = await import("@/components/inventory/KeluarTable");

    KeluarTable({});

    expect(useRealtimeScopeMock).toHaveBeenCalledWith({
      kind: "admin",
      id: "inventory",
    });
    expect(useRealtimeEventMock).toHaveBeenCalledWith(
      "inventory.update",
      expect.any(Function),
    );
  });
});
