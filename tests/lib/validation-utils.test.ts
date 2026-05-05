import { describe, it, expect } from "vitest";
import {
  validateCoordinates,
  validateAttendanceStatus,
  validateRequired,
  validatePagination,
  validateDaysRange,
  VALID_ATTENDANCE_STATUSES,
} from "@/lib/validation-utils";

describe("validation-utils", () => {
  describe("validateCoordinates", () => {
    it("harus return valid untuk koordinat yang benar", () => {
      const result = validateCoordinates(-6.2088, 106.8456);

      expect(result.valid).toBe(true);
      expect(result.latitude).toBe(-6.2088);
      expect(result.longitude).toBe(106.8456);
    });

    it("harus parse string coordinates", () => {
      const result = validateCoordinates("-6.2088", "106.8456");

      expect(result.valid).toBe(true);
      expect(result.latitude).toBe(-6.2088);
      expect(result.longitude).toBe(106.8456);
    });

    it("harus return valid untuk null/undefined (optional)", () => {
      const result1 = validateCoordinates(null, null);
      const result2 = validateCoordinates(undefined, undefined);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });

    it("harus return error untuk koordinat NaN", () => {
      const result = validateCoordinates("invalid", "invalid");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Koordinat tidak valid");
      expect(result.code).toBe("INVALID_COORDINATES");
    });

    it("harus return error untuk latitude di luar range", () => {
      const result1 = validateCoordinates(-91, 106.8456);
      const result2 = validateCoordinates(91, 106.8456);

      expect(result1.valid).toBe(false);
      expect(result1.code).toBe("INVALID_LATITUDE");
      expect(result2.valid).toBe(false);
      expect(result2.code).toBe("INVALID_LATITUDE");
    });

    it("harus return error untuk longitude di luar range", () => {
      const result1 = validateCoordinates(-6.2088, -181);
      const result2 = validateCoordinates(-6.2088, 181);

      expect(result1.valid).toBe(false);
      expect(result1.code).toBe("INVALID_LONGITUDE");
      expect(result2.valid).toBe(false);
      expect(result2.code).toBe("INVALID_LONGITUDE");
    });

    it("harus accept koordinat di boundary", () => {
      const result1 = validateCoordinates(-90, -180);
      const result2 = validateCoordinates(90, 180);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(true);
    });
  });

  describe("validateAttendanceStatus", () => {
    it("harus return valid untuk status yang benar", () => {
      VALID_ATTENDANCE_STATUSES.forEach((status) => {
        const result = validateAttendanceStatus(status);
        expect(result.valid).toBe(true);
      });
    });

    it("harus return error untuk status tidak valid", () => {
      const result = validateAttendanceStatus("INVALID_STATUS");

      expect(result.valid).toBe(false);
      expect(result.error).toContain("Status tidak valid");
      expect(result.code).toBe("INVALID_STATUS");
    });

    it("harus return error untuk empty string", () => {
      const result = validateAttendanceStatus("");

      expect(result.valid).toBe(false);
      expect(result.code).toBe("INVALID_STATUS");
    });
  });

  describe("validateRequired", () => {
    it("harus return valid untuk string yang ada", () => {
      const result = validateRequired("test value", "Test Field");

      expect(result.valid).toBe(true);
    });

    it("harus return error untuk null", () => {
      const result = validateRequired(null, "Test Field");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Test Field wajib diisi");
      expect(result.code).toBe("REQUIRED_FIELD");
    });

    it("harus return error untuk undefined", () => {
      const result = validateRequired(undefined, "Test Field");

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Test Field wajib diisi");
      expect(result.code).toBe("REQUIRED_FIELD");
    });

    it("harus return error untuk empty string", () => {
      const result = validateRequired("", "Test Field");

      expect(result.valid).toBe(false);
      expect(result.code).toBe("REQUIRED_FIELD");
    });

    it("harus return error untuk whitespace only", () => {
      const result = validateRequired("   ", "Test Field");

      expect(result.valid).toBe(false);
      expect(result.code).toBe("REQUIRED_FIELD");
    });
  });

  describe("validatePagination", () => {
    it("harus return default values untuk undefined", () => {
      const result = validatePagination(undefined, undefined);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.skip).toBe(0);
    });

    it("harus parse string values", () => {
      const result = validatePagination("2", "20");

      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(20);
    });

    it("harus calculate skip correctly", () => {
      const result1 = validatePagination(1, 10);
      const result2 = validatePagination(2, 10);
      const result3 = validatePagination(3, 20);

      expect(result1.skip).toBe(0);
      expect(result2.skip).toBe(10);
      expect(result3.skip).toBe(40);
    });

    it("harus enforce maxLimit", () => {
      const result = validatePagination(1, 200, 100);

      expect(result.limit).toBe(100);
    });

    it("harus handle invalid page numbers", () => {
      const result1 = validatePagination(0, 10);
      const result2 = validatePagination(-5, 10);
      const result3 = validatePagination("invalid", 10);

      expect(result1.page).toBe(1);
      expect(result2.page).toBe(1);
      expect(result3.page).toBe(1);
    });

    it("harus handle invalid limit numbers", () => {
      const result1 = validatePagination(1, 0);
      const result2 = validatePagination(1, -10);
      const result3 = validatePagination(1, "invalid");

      expect(result1.limit).toBe(10);
      expect(result2.limit).toBe(10);
      expect(result3.limit).toBe(10);
    });

    it("harus use custom maxLimit", () => {
      const result = validatePagination(1, 500, 200);

      expect(result.limit).toBe(200);
    });
  });

  describe("validateDaysRange", () => {
    it("harus return default untuk undefined", () => {
      const result = validateDaysRange(undefined);

      expect(result).toBe(30);
    });

    it("harus return default untuk null", () => {
      const result = validateDaysRange(null);

      expect(result).toBe(30);
    });

    it("harus parse string values", () => {
      const result = validateDaysRange("60");

      expect(result).toBe(60);
    });

    it("harus enforce maxDays", () => {
      const result = validateDaysRange(500, 365);

      expect(result).toBe(365);
    });

    it("harus enforce minimum 1 day", () => {
      const result = validateDaysRange(0);

      expect(result).toBe(1);
    });

    it("harus return default untuk invalid string", () => {
      const result = validateDaysRange("invalid");

      expect(result).toBe(30);
    });

    it("harus use custom default", () => {
      const result = validateDaysRange(undefined, 365, 60);

      expect(result).toBe(60);
    });

    it("harus use custom maxDays", () => {
      const result = validateDaysRange(200, 180);

      expect(result).toBe(180);
    });

    it("harus handle negative numbers", () => {
      const result = validateDaysRange(-10);

      expect(result).toBe(1);
    });
  });
});
