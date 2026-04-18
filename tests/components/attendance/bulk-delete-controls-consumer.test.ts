import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

describe("AttendanceClient bulk delete controls consumer", () => {
  it("wires page size and selection state for bulk delete flow", () => {
    const content = readFileSync(
      join(process.cwd(), "app", "admin", "attendance", "AttendanceClient.tsx"),
      "utf8",
    );

    expect(content).toContain("const [pageSize, setPageSize] = useState(10)");
    expect(content).toContain(
      "const [selectedAttendanceIds, setSelectedAttendanceIds] = useState<string[]>([])",
    );
    expect(content).toContain(
      "const [isBulkDeleting, setIsBulkDeleting] = useState(false)",
    );
    expect(content).toContain("limit: pageSize.toString()");
    expect(content).toContain("itemsPerPage={pageSize}");
    expect(content).toContain(
      "itemsPerPageOptions={[10, 20, 30, 40, 50, 100]}",
    );
    expect(content).toContain("const nextPageSize = Number(value)");
    expect(content).toContain("if (Number.isNaN(nextPageSize))");
    expect(content).toContain("setPageSize(nextPageSize)");
    expect(content).toContain("setSelectedAttendanceIds([])");
    expect(content).toContain("canDelete && (");
    expect(content).toContain("Hapus Terpilih");
    expect(content).toContain("disabled={isBulkDeleting}");
    expect(content).toContain('method: "DELETE"');
    expect(content).toContain(
      "body: JSON.stringify({ ids: selectedAttendanceIds })",
    );
    expect(content).toContain("toggleCurrentPageAttendanceSelection");
    expect(content).toContain("areAllAttendanceIdsSelected");
  });
});
