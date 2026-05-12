import { test, expect } from "@playwright/test";

test.describe("User Role Display E2E", () => {
  test.use({ viewport: { width: 1920, height: 1080 } });

  test("should verify role appears in user list after creation", async ({
    page,
  }) => {
    // Listen to console messages for debugging
    page.on("console", (msg) => {
      if (
        msg.type() === "error" ||
        msg.text().includes("role") ||
        msg.text().includes("reference")
      ) {
        console.log(`Browser console [${msg.type()}]:`, msg.text());
      }
    });

    console.log("Navigating to login page...");
    await page.goto("http://localhost:3000/admin/login");
    await page.waitForLoadState("domcontentloaded");

    // Wait for form to be fully interactive
    console.log("Waiting for login form...");
    await page.waitForSelector('input[name="email"]', { state: "visible" });
    await page.waitForSelector('input[name="password"]', { state: "visible" });
    await page.waitForSelector('button[type="submit"]', { state: "visible" });

    // Login
    console.log("Logging in...");
    await page.locator('input[name="email"]').fill("rama@sblnet.id");
    await page.locator('input[name="password"]').fill("Rama12#");

    // Click login and wait for auth callback response
    console.log("Submitting login form...");
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/auth/callback/credentials") &&
          resp.status() === 200,
        { timeout: 15000 },
      ),
      page.locator('button[type="submit"]').click(),
    ]);
    console.log("Login response status:", response.status());

    // Wait for redirect to complete
    await page.waitForURL("**/admin/**", { timeout: 10000 });
    console.log("Current URL after login:", page.url());

    // Click "Karyawan" link in sidebar to navigate to users page
    console.log("Navigating to users page via sidebar...");
    await page.click('a[href="/admin/users"]');
    await page.waitForURL("**/admin/users", { timeout: 10000 });
    console.log("Current URL:", page.url());

    // Take screenshot for debugging
    await page.screenshot({
      path: "test-results/01-users-page-loaded.png",
    });

    // Wait for table to load
    await page.waitForSelector("tbody", { timeout: 10000 });

    // Get initial user count
    const initialRows = await page.locator("tbody tr").count();
    console.log(`Initial user count: ${initialRows}`);

    // Verify role column exists in header
    const roleHeader = page.locator('th:has-text("Peran")');
    await expect(roleHeader).toBeVisible();
    console.log("Role column header found");

    // Check if existing users have roles displayed
    if (initialRows > 0) {
      const firstRow = page.locator("tbody tr").first();
      const cells = firstRow.locator("td");
      const cellCount = await cells.count();
      console.log(`First row has ${cellCount} cells`);

      // Find role cell (usually 4th column based on userColumns.tsx)
      const roleCell = cells.nth(3);
      const roleText = await roleCell.textContent();
      console.log(`First user role: ${roleText}`);

      // Verify role is not empty
      expect(roleText?.trim()).not.toBe("");
      expect(roleText?.trim()).not.toBe("-");
    }

    // Test consistency: refresh 3 times and verify roles still appear
    for (let i = 1; i <= 3; i++) {
      console.log(`Refresh test ${i}/3...`);
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForSelector("tbody", { timeout: 10000 });

      const rowsAfterRefresh = await page.locator("tbody tr").count();
      expect(rowsAfterRefresh).toBe(initialRows);

      if (initialRows > 0) {
        const firstRow = page.locator("tbody tr").first();
        const roleCell = firstRow.locator("td").nth(3);
        const roleText = await roleCell.textContent();
        console.log(`Refresh ${i}: Role still displayed as ${roleText}`);

        // Verify role is still not empty
        expect(roleText?.trim()).not.toBe("");
        expect(roleText?.trim()).not.toBe("-");
      }
    }

    await page.screenshot({ path: "test-results/02-final-state.png" });
    console.log("Test completed successfully!");

    // Buka form create user untuk verifikasi semua dropdown referensi
    console.log("\n=== Verifikasi dropdown referensi pada form user baru ===");

    const rolesApiPromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes("/api/roles?filterRestricted=true") &&
          resp.status() === 200,
        { timeout: 15000 },
      )
      .catch((): null => null);

    await page.click('a[href="/admin/users/new"]');
    await page.waitForURL("**/admin/users/new", { timeout: 10000 });
    console.log("User form opened");

    const rolesResponse = await rolesApiPromise;
    if (rolesResponse) {
      const rolesData = await rolesResponse.json();
      console.log(
        "Available roles count:",
        Array.isArray(rolesData) ? rolesData.length : 0,
      );
    }

    await page.waitForTimeout(1000);

    const roleOptionsCount = await page.evaluate(() => {
      const select = document.querySelector(
        'select[name="roleId"]',
      ) as HTMLSelectElement | null;
      return select?.options.length ?? 0;
    });
    console.log("Role options count:", roleOptionsCount);
    expect(roleOptionsCount).toBeGreaterThan(1);

    const departmentOptionsCount = await page.evaluate(() => {
      const select = document.querySelector(
        'select[name="departmentId"]',
      ) as HTMLSelectElement | null;
      return select?.options.length ?? 0;
    });
    console.log("Department options count:", departmentOptionsCount);
    expect(departmentOptionsCount).toBeGreaterThan(1);

    const sitePlaceholder = page
      .locator("text=Pilih Site (bisa lebih dari satu)")
      .first();
    await expect(sitePlaceholder).toBeVisible();

    await page.screenshot({
      path: "test-results/03-dropdown-reference-verified.png",
    });
    console.log("Role, department, dan site selector berhasil ditampilkan.");
  });
});
