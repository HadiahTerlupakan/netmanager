import { describe, it, expect } from "vitest";
import {
  validateWorkDays,
  detectFormat,
  workDaysSchema,
  workDaysOptionalSchema,
} from "@/modules/users/validators/workDays.validator";

describe("workDays Validator", () => {
  describe("detectFormat", () => {
    it("should detect short-english format", () => {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      expect(detectFormat(days)).toBe("short-english");
    });

    it("should detect full-english format", () => {
      const days = ["Monday", "Tuesday", "Wednesday"];
      expect(detectFormat(days)).toBe("full-english");
    });

    it("should detect indonesian format", () => {
      const days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
      expect(detectFormat(days)).toBe("indonesian");
    });

    it("should detect numeric format", () => {
      const days = ["1", "2", "3", "4", "5"];
      expect(detectFormat(days)).toBe("numeric");
    });

    it("should return null for mixed format", () => {
      const days = ["Mon", "Tuesday", "Rabu", "4"];
      expect(detectFormat(days)).toBeNull();
    });

    it("should return null for invalid days", () => {
      const days = ["InvalidDay", "AnotherDay"];
      expect(detectFormat(days)).toBeNull();
    });
  });

  describe("validateWorkDays", () => {
    describe("Valid formats", () => {
      it("should accept valid short-english format", () => {
        expect(() => validateWorkDays("Mon,Tue,Wed,Thu,Fri")).not.toThrow();
      });

      it("should accept valid full-english format", () => {
        expect(() =>
          validateWorkDays("Monday,Tuesday,Wednesday,Thursday,Friday"),
        ).not.toThrow();
      });

      it("should accept valid indonesian format", () => {
        expect(() =>
          validateWorkDays("Senin,Selasa,Rabu,Kamis,Jumat"),
        ).not.toThrow();
      });

      it("should accept valid numeric format", () => {
        expect(() => validateWorkDays("1,2,3,4,5")).not.toThrow();
      });

      it("should accept single working day", () => {
        expect(() => validateWorkDays("Mon")).not.toThrow();
      });

      it("should accept all 7 days", () => {
        expect(() =>
          validateWorkDays("Mon,Tue,Wed,Thu,Fri,Sat,Sun"),
        ).not.toThrow();
      });

      it("should accept days in any order", () => {
        expect(() => validateWorkDays("Fri,Mon,Wed,Tue,Thu")).not.toThrow();
      });

      it("should handle extra whitespace", () => {
        expect(() => validateWorkDays("Mon, Tue, Wed, Thu, Fri")).not.toThrow();
      });
    });

    describe("Invalid formats", () => {
      it("should reject empty string", () => {
        expect(() => validateWorkDays("")).toThrow(
          "workDays tidak boleh kosong",
        );
      });

      it("should reject more than 7 days", () => {
        expect(() =>
          validateWorkDays("Mon,Tue,Wed,Thu,Fri,Sat,Sun,Mon"),
        ).toThrow("workDays tidak boleh lebih dari 7 hari");
      });

      it("should reject duplicate days", () => {
        expect(() => validateWorkDays("Mon,Tue,Mon,Wed")).toThrow(
          "workDays tidak boleh memiliki hari yang duplikat",
        );
      });

      it("should reject mixed format (short + full english)", () => {
        expect(() => validateWorkDays("Mon,Tuesday,Wed")).toThrow(
          "Format workDays tidak valid",
        );
      });

      it("should reject mixed format (english + indonesian)", () => {
        expect(() => validateWorkDays("Mon,Selasa,Wed")).toThrow(
          "Format workDays tidak valid",
        );
      });

      it("should reject mixed format (numeric + text)", () => {
        expect(() => validateWorkDays("1,Mon,3")).toThrow(
          "Format workDays tidak valid",
        );
      });

      it("should reject invalid day names", () => {
        expect(() => validateWorkDays("InvalidDay,AnotherDay")).toThrow(
          "Format workDays tidak valid",
        );
      });

      it("should reject partial day names", () => {
        expect(() => validateWorkDays("Mo,Tu,We")).toThrow(
          "Format workDays tidak valid",
        );
      });

      it("should reject numeric out of range", () => {
        expect(() => validateWorkDays("1,2,8,9")).toThrow(
          "Format workDays tidak valid",
        );
      });
    });
  });

  describe("workDaysSchema (Zod)", () => {
    it("should parse valid workDays", () => {
      const result = workDaysSchema.safeParse("Mon,Tue,Wed,Thu,Fri");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Mon,Tue,Wed,Thu,Fri");
      }
    });

    it("should reject invalid workDays", () => {
      const result = workDaysSchema.safeParse("InvalidDay");
      expect(result.success).toBe(false);
    });

    it("should reject empty string", () => {
      const result = workDaysSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("should reject duplicate days", () => {
      const result = workDaysSchema.safeParse("Mon,Tue,Mon");
      expect(result.success).toBe(false);
    });
  });

  describe("workDaysOptionalSchema (Zod)", () => {
    it("should accept undefined", () => {
      const result = workDaysOptionalSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should parse valid workDays", () => {
      const result = workDaysOptionalSchema.safeParse("Mon,Tue,Wed");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Mon,Tue,Wed");
      }
    });

    it("should reject invalid workDays", () => {
      const result = workDaysOptionalSchema.safeParse("InvalidDay");
      expect(result.success).toBe(false);
    });

    it("should reject empty string", () => {
      const result = workDaysOptionalSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle weekend-only schedule", () => {
      expect(() => validateWorkDays("Sat,Sun")).not.toThrow();
    });

    it("should handle single day (Sunday)", () => {
      expect(() => validateWorkDays("Sun")).not.toThrow();
    });

    it("should handle numeric 0 (Sunday)", () => {
      expect(() => validateWorkDays("0")).not.toThrow();
    });

    it("should handle all days in reverse order", () => {
      expect(() =>
        validateWorkDays("Sat,Fri,Thu,Wed,Tue,Mon,Sun"),
      ).not.toThrow();
    });

    it("should trim whitespace correctly", () => {
      expect(() => validateWorkDays("  Mon  ,  Tue  ,  Wed  ")).not.toThrow();
    });
  });
});
