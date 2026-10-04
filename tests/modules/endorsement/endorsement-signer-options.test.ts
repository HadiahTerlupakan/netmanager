import { describe, expect, it, vi } from "vitest";
import { EndorsementSignerOptionsService } from "@/modules/endorsement/services/EndorsementSignerOptionsService";

describe("EndorsementSignerOptionsService", () => {
  it("memetakan karyawan ke pilihan dengan jabatan dari peran atau departemen", async () => {
    const directory = {
      searchActiveEmployees: vi.fn().mockResolvedValue([
        { id: "u1", name: "Budi", email: "budi@x.id", phone: "0812", role: { name: "Direktur" }, departments: null },
        { id: "u2", name: null, email: "sari@x.id", phone: null, role: null, departments: { name: "Legal" } },
      ]),
    };

    const options = await new EndorsementSignerOptionsService(directory).search("bu");

    expect(directory.searchActiveEmployees).toHaveBeenCalledWith("bu", 20);
    expect(options).toEqual([
      { userId: "u1", name: "Budi", role: "Direktur", email: "budi@x.id", phone: "0812" },
      { userId: "u2", name: "sari@x.id", role: "Legal", email: "sari@x.id", phone: null },
    ]);
  });
});
