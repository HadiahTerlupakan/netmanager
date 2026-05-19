import { describe, expect, it } from "vitest";

import {
  buildWorkOrderPayload,
  type WorkOrderFormData,
  type SiteRef,
  type DepartmentRef,
} from "@/app/admin/workorders/new/work-order-payload";
import { workOrderCreateSchema } from "@/lib/validations/workorder";

const SITE_A: SiteRef = { id: "site-a", code: "JKT", name: "Jakarta" };
const DEPT_A: DepartmentRef = { id: "dept-a", name: "Network Engineering" };

function baseFormData(
  overrides: Partial<WorkOrderFormData> = {},
): WorkOrderFormData {
  return {
    ticketId: "",
    pelangganId: "",
    siteId: "",
    departmentId: "",
    type: "TROUBLESHOOT",
    title: "Internet down",
    description: "Customer reports outage",
    priority: "NORMAL",
    locationAddress: "",
    contactName: "",
    contactPhone: "",
    scheduledDate: "",
    scheduledTimeStart: "",
    scheduledTimeEnd: "",
    disconnectionReason: "",
    templateId: "",
    ...overrides,
  };
}

describe("buildWorkOrderPayload", () => {
  describe("pelangganId", () => {
    it("returns undefined for INTERNAL workorder", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ pelangganId: "pel-1" }),
        woType: "INTERNAL",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.pelangganId).toBeUndefined();
    });

    it("returns undefined for CUSTOMER guest mode", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ pelangganId: "pel-1" }),
        woType: "CUSTOMER",
        isGuest: true,
        sites: [],
        departments: [],
      });
      expect(payload.pelangganId).toBeUndefined();
    });

    it("returns undefined for empty pelangganId in CUSTOMER mode", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ pelangganId: "" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.pelangganId).toBeUndefined();
    });

    it("returns id when CUSTOMER mode dengan pelangganId valid", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ pelangganId: "pel-99" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.pelangganId).toBe("pel-99");
    });

    it("never returns null", () => {
      const inputs = [
        { woType: "INTERNAL" as const, isGuest: false },
        { woType: "INTERNAL" as const, isGuest: true },
        { woType: "CUSTOMER" as const, isGuest: true },
        { woType: "CUSTOMER" as const, isGuest: false },
      ];
      for (const variant of inputs) {
        const payload = buildWorkOrderPayload({
          formData: baseFormData(),
          ...variant,
          sites: [],
          departments: [],
        });
        expect(payload.pelangganId).not.toBeNull();
      }
    });
  });

  describe("isInternal flag", () => {
    it("true untuk woType INTERNAL", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData(),
        woType: "INTERNAL",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.isInternal).toBe(true);
    });

    it("false untuk woType CUSTOMER", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData(),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.isInternal).toBe(false);
    });
  });

  describe("contactName", () => {
    it("INTERNAL pakai nama department bila tersedia", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ departmentId: "dept-a" }),
        woType: "INTERNAL",
        isGuest: false,
        sites: [],
        departments: [DEPT_A],
      });
      expect(payload.contactName).toBe(DEPT_A.name);
    });

    it("INTERNAL fallback ke 'Internal Team' bila department tidak ditemukan", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ departmentId: "missing" }),
        woType: "INTERNAL",
        isGuest: false,
        sites: [],
        departments: [DEPT_A],
      });
      expect(payload.contactName).toBe("Internal Team");
    });

    it("CUSTOMER guest pakai 'Guest' bila contactName kosong", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ contactName: "" }),
        woType: "CUSTOMER",
        isGuest: true,
        sites: [],
        departments: [],
      });
      expect(payload.contactName).toBe("Guest");
    });

    it("CUSTOMER guest pakai contactName eksplisit bila diisi", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ contactName: "Pak Bambang" }),
        woType: "CUSTOMER",
        isGuest: true,
        sites: [],
        departments: [],
      });
      expect(payload.contactName).toBe("Pak Bambang");
    });

    it("CUSTOMER non-guest tanpa contactName → undefined", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ contactName: "" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.contactName).toBeUndefined();
    });
  });

  describe("locationAddress", () => {
    it("INTERNAL dengan site terpilih → format 'Site: <code> - <name>'", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ siteId: "site-a" }),
        woType: "INTERNAL",
        isGuest: false,
        sites: [SITE_A],
        departments: [],
      });
      expect(payload.locationAddress).toBe("Site: JKT - Jakarta");
    });

    it("INTERNAL tanpa site → fallback ke formAddress", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({
          siteId: "missing",
          locationAddress: "Manual address",
        }),
        woType: "INTERNAL",
        isGuest: false,
        sites: [SITE_A],
        departments: [],
      });
      expect(payload.locationAddress).toBe("Manual address");
    });

    it("CUSTOMER pakai locationAddress dari form", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ locationAddress: "Jl. Sudirman 1" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.locationAddress).toBe("Jl. Sudirman 1");
    });
  });

  describe("scheduledDate", () => {
    it("transforms ISO string ke Date object", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ scheduledDate: "2026-06-01T08:00" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.scheduledDate).toBeInstanceOf(Date);
    });

    it("undefined bila form scheduledDate kosong", () => {
      const payload = buildWorkOrderPayload({
        formData: baseFormData({ scheduledDate: "" }),
        woType: "CUSTOMER",
        isGuest: false,
        sites: [],
        departments: [],
      });
      expect(payload.scheduledDate).toBeUndefined();
    });
  });
});

describe("workOrderCreateSchema vs buildWorkOrderPayload integration", () => {
  it("payload dari INTERNAL flow lolos Zod schema", () => {
    const payload = buildWorkOrderPayload({
      formData: baseFormData({
        siteId: "site-a",
        departmentId: "dept-a",
      }),
      woType: "INTERNAL",
      isGuest: false,
      sites: [SITE_A],
      departments: [DEPT_A],
    });
    const result = workOrderCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("payload dari CUSTOMER guest flow lolos Zod schema", () => {
    const payload = buildWorkOrderPayload({
      formData: baseFormData({ contactName: "Guest 1" }),
      woType: "CUSTOMER",
      isGuest: true,
      sites: [],
      departments: [],
    });
    const result = workOrderCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("payload dari CUSTOMER non-guest dengan pelangganId lolos Zod schema", () => {
    const payload = buildWorkOrderPayload({
      formData: baseFormData({ pelangganId: "pel-1" }),
      woType: "CUSTOMER",
      isGuest: false,
      sites: [],
      departments: [],
    });
    const result = workOrderCreateSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("regression: pelangganId null di-reject schema (akar bug sebelum fix)", () => {
    // Simulasi payload lama yang kirim null untuk INTERNAL/Guest
    const buggyPayload: Record<string, unknown> = {
      type: "TROUBLESHOOT",
      title: "X",
      description: "Y",
      pelangganId: null,
    };
    const result = workOrderCreateSchema.safeParse(buggyPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("pelangganId"),
      );
      expect(issue).toBeDefined();
      expect(issue?.message.toLowerCase()).toContain("string");
    }
  });

  it("payload dengan title/description kosong ditolak schema", () => {
    const payload = buildWorkOrderPayload({
      formData: baseFormData({ title: "", description: "" }),
      woType: "CUSTOMER",
      isGuest: false,
      sites: [],
      departments: [],
    });
    const result = workOrderCreateSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
