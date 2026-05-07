import { test, expect } from "@playwright/test";

test("Test Tambah Pengguna button styling in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("http://localhost:3000/admin/login");
  await page.waitForLoadState("networkidle");

  await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Password")).toBeVisible({ timeout: 10000 });

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("admin123");

  console.log("Submitting admin login form.");
  await page.getByRole("button", { name: "Masuk" }).click();

  await page.waitForURL("**/admin", { timeout: 10000 });
  console.log("Logged in, current URL:", page.url());

  await page.goto("http://localhost:3000/admin/users");
  await expect(
    page.getByRole("heading", { name: "Manajemen Pengguna" }),
  ).toBeVisible({ timeout: 10000 });

  // Wait for button to be visible
  const addButton = page.getByRole("link", { name: /Tambah Pengguna/i });
  await expect(addButton).toBeVisible({ timeout: 10000 });

  // Take screenshot of the header area with button
  await page.screenshot({
    path: "/tmp/users-header-darkmode.png",
    fullPage: false,
  });

  console.log("Screenshot saved to /tmp/users-header-darkmode.png");
});
