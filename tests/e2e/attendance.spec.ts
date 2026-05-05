import { test, expect } from "@playwright/test";

test.describe("Attendance Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login sebagai karyawan
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("employee@test.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/karyawan/);
  });

  test("harus menampilkan halaman attendance", async ({ page }) => {
    await page.goto("/karyawan/attendance");

    await expect(page.locator("h1")).toContainText(/attendance|absensi/i);
    await expect(page.locator('button:has-text("Check In")')).toBeVisible();
  });

  test("harus bisa check in", async ({ page }) => {
    await page.goto("/karyawan/attendance");

    // Click check in button
    await page.locator('button:has-text("Check In")').click();

    // Harus muncul form check in
    await expect(page.locator('input[name="location"]')).toBeVisible();

    // Fill form
    await page.locator('input[name="location"]').fill("Office");
    await page.locator('textarea[name="notes"]').fill("Check in from office");

    // Submit
    await page.locator('button[type="submit"]').click();

    // Harus muncul success message
    await expect(page.locator("text=/check.*in.*success/i")).toBeVisible();

    // Check out button harus muncul
    await expect(page.locator('button:has-text("Check Out")')).toBeVisible();
  });

  test("harus menampilkan attendance history", async ({ page }) => {
    await page.goto("/karyawan/attendance/history");

    await expect(page.locator("h1")).toContainText(/history|riwayat/i);

    // Harus ada tabel atau list attendance
    await expect(page.locator('table, [role="list"]')).toBeVisible();
  });

  test("harus bisa filter attendance history by date", async ({ page }) => {
    await page.goto("/karyawan/attendance/history");

    // Select date range
    await page.locator('input[name="startDate"]').fill("2026-05-01");
    await page.locator('input[name="endDate"]').fill("2026-05-31");
    await page.locator('button:has-text("Filter")').click();

    // Harus reload dengan filter
    await expect(page).toHaveURL(/startDate=2026-05-01/);
  });

  test("harus menampilkan attendance statistics", async ({ page }) => {
    await page.goto("/karyawan/attendance");

    // Harus ada statistics cards
    await expect(page.locator("text=/total.*days/i")).toBeVisible();
    await expect(page.locator("text=/present/i")).toBeVisible();
    await expect(page.locator("text=/absent/i")).toBeVisible();
  });

  test("harus bisa check out setelah check in", async ({ page }) => {
    await page.goto("/karyawan/attendance");

    // Asumsi sudah check in
    const checkOutButton = page.locator('button:has-text("Check Out")');

    if (await checkOutButton.isVisible()) {
      await checkOutButton.click();

      // Fill form
      await page.locator('input[name="location"]').fill("Office");
      await page
        .locator('textarea[name="notes"]')
        .fill("Check out from office");

      // Submit
      await page.locator('button[type="submit"]').click();

      // Harus muncul success message
      await expect(page.locator("text=/check.*out.*success/i")).toBeVisible();

      // Check in button harus muncul lagi
      await expect(page.locator('button:has-text("Check In")')).toBeVisible();
    }
  });
});
