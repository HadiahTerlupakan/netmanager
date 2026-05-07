import { test, expect } from "@playwright/test";

test("Test compare button in dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });

  await page.goto("http://localhost:3000/admin/login");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: "/tmp/01-admin-login-page.png",
    fullPage: true,
  });

  console.log("Current URL after goto admin login:", page.url());

  await expect(page.getByLabel("Email")).toBeVisible({ timeout: 10000 });
  await expect(page.getByLabel("Password")).toBeVisible({ timeout: 10000 });

  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("admin123");
  await page.screenshot({ path: "/tmp/02-admin-filled-form.png" });

  console.log("Submitting admin login form...");
  await page.getByRole("button", { name: "Masuk" }).click();

  await page.waitForURL("**/admin", { timeout: 10000 });
  console.log("Logged in, current URL:", page.url());
  await page.screenshot({
    path: "/tmp/03-after-admin-login.png",
    fullPage: true,
  });

  await page.goto("http://localhost:3000/admin/users");
  await expect(
    page.getByRole("heading", { name: "Manajemen Pengguna" }),
  ).toBeVisible({ timeout: 10000 });

  const checkboxLocator = page.locator('input[type="checkbox"].cursor-pointer');
  await expect(checkboxLocator.first()).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: "/tmp/04-users-page.png", fullPage: true });
  const checkboxCount = await checkboxLocator.count();
  console.log("Found checkboxes:", checkboxCount);

  if (checkboxCount >= 2) {
    console.log("Selecting first two users...");
    await checkboxLocator.nth(0).check();
    await page.waitForTimeout(500);
    await checkboxLocator.nth(1).check();
    await page.waitForTimeout(1000);

    const compareBar = page.getByText(/Pengguna Terpilih/);
    await expect(compareBar).toBeVisible();
    console.log("Compare bar visible: true");

    await page.screenshot({
      path: "/tmp/05-after-selection.png",
      fullPage: true,
    });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await page.screenshot({ path: "/tmp/06-compare-bar.png", fullPage: true });
  } else {
    console.log(
      "Not enough checkboxes found. Table might be empty or still loading.",
    );
  }

  console.log("Screenshots saved to /tmp/");
});
