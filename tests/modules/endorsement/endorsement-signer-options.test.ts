import { describe, expect, it, vi } from "vitest";
import { EndorsementSignerOptionsService } from "@/modules/endorsement/services/EndorsementSignerOptionsService";
import { UserLookupService } from "@/modules/users/services/UserLookupService";

describe("EndorsementSignerOptionsService", () => {
  it("meneruskan pencarian ke direktori karyawan dengan batas 20", async () => {
    const directory = { searchEmployeeOptions: vi.fn().mockResolvedValue([]) };

    await new EndorsementSignerOptionsService(directory).search("bu");

    expect(directory.searchEmployeeOptions).toHaveBeenCalledWith("bu", 20);
  });
});

describe("UserLookupService.searchEmployeeOptions", () => {
  it("memetakan karyawan ke pilihan dengan jabatan dari peran atau departemen", async () => {
    const lookupRepository = {
      searchActiveEmployees: vi.fn().mockResolvedValue([
        { id: "u1", name: "Budi", email: "budi@x.id", phone: "0812", role: { name: "Direktur" }, departments: null },
        { id: "u2", name: null, email: "sari@x.id", phone: null, role: null, departments: { name: "Legal" } },
      ]),
    };
    const service = new UserLookupService(undefined, lookupRepository as never);

    expect(await service.searchEmployeeOptions("bu", 20)).toEqual([
      { userId: "u1", name: "Budi", role: "Direktur", email: "budi@x.id", phone: "0812" },
      { userId: "u2", name: "sari@x.id", role: "Legal", email: "sari@x.id", phone: null },
    ]);
  });
});
