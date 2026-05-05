import { test, expect } from "@playwright/test";

test.describe("Login Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("harus menampilkan halaman login", async ({ page }) => {
    await expect(page).toHaveTitle(/Login/i);
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("harus menampilkan error untuk kredensial kosong", async ({ page }) => {
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=/email.*required/i")).toBeVisible();
    await expect(page.locator("text=/password.*required/i")).toBeVisible();
  });

  test("harus menampilkan error untuk email tidak valid", async ({ page }) => {
    await page.locator('input[name="email"]').fill("invalid-email");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=/email.*invalid/i")).toBeVisible();
  });

  test("harus menampilkan error untuk kredensial salah", async ({ page }) => {
    await page.locator('input[name="email"]').fill("wrong@example.com");
    await page.locator('input[name="password"]').fill("wrongpassword");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=/invalid.*credentials/i")).toBeVisible();
  });

  test("harus berhasil login dengan kredensial valid", async ({ page }) => {
    // Note: Test ini memerlukan test user di database
    await page.locator('input[name="email"]').fill("admin@test.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    // Setelah login berhasil, harus redirect ke dashboard
    await expect(page).toHaveURL(/\/admin|\/karyawan|\/dashboard/);
  });

  test("harus bisa logout setelah login", async ({ page }) => {
    // Login dulu
    await page.locator('input[name="email"]').fill("admin@test.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/admin|\/karyawan|\/dashboard/);

    // Logout
    await page.locator('button[aria-label="User menu"]').click();
    await page.locator("text=/logout/i").click();

    // Harus kembali ke login page
    await expect(page).toHaveURL("/login");
  });

  test("harus redirect ke login jika akses protected route tanpa auth", async ({
    page,
  }) => {
    await page.goto("/admin/dashboard");

    // Harus redirect ke login
    await expect(page).toHaveURL("/login");
  });
});
