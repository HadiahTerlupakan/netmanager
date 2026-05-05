import { test, expect } from "@playwright/test";

test.describe("Work Order Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login sebagai admin
    await page.goto("/login");
    await page.locator('input[name="email"]').fill("admin@test.com");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/admin/);
  });

  test("harus menampilkan halaman work order list", async ({ page }) => {
    await page.goto("/admin/work-orders");

    await expect(page.locator("h1")).toContainText(/work.*order/i);
    await expect(page.locator('button:has-text("Create")')).toBeVisible();
  });

  test("harus bisa create work order", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Click create button
    await page.locator('button:has-text("Create")').click();

    // Harus muncul form
    await expect(page.locator('input[name="title"]')).toBeVisible();

    // Fill form
    await page.locator('select[name="type"]').selectOption("MAINTENANCE");
    await page.locator('input[name="title"]').fill("Test Work Order");
    await page.locator('textarea[name="description"]').fill("Test Description");
    await page.locator('select[name="priority"]').selectOption("HIGH");

    // Submit
    await page.locator('button[type="submit"]').click();

    // Harus muncul success message
    await expect(page.locator("text=/work.*order.*created/i")).toBeVisible();

    // Harus redirect ke detail page
    await expect(page).toHaveURL(/\/admin\/work-orders\/[a-z0-9-]+/);
  });

  test("harus menampilkan work order detail", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Click first work order
    await page.locator("table tbody tr").first().click();

    // Harus ada detail
    await expect(page.locator("text=/work.*order.*number/i")).toBeVisible();
    await expect(page.locator("text=/status/i")).toBeVisible();
    await expect(page.locator("text=/priority/i")).toBeVisible();
  });

  test("harus bisa update work order status", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Click first work order
    await page.locator("table tbody tr").first().click();

    // Click status dropdown
    await page.locator('button:has-text("Change Status")').click();

    // Select new status
    await page.locator("text=/in.*progress/i").click();

    // Harus muncul success message
    await expect(page.locator("text=/status.*updated/i")).toBeVisible();
  });

  test("harus bisa assign work order", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Click first work order
    await page.locator("table tbody tr").first().click();

    // Click assign button
    await page.locator('button:has-text("Assign")').click();

    // Select technician
    await page
      .locator('select[name="assignedToId"]')
      .selectOption({ index: 1 });

    // Submit
    await page.locator('button[type="submit"]').click();

    // Harus muncul success message
    await expect(page.locator("text=/assigned.*successfully/i")).toBeVisible();
  });

  test("harus bisa filter work orders", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Filter by status
    await page.locator('select[name="status"]').selectOption("PENDING");

    // Filter by priority
    await page.locator('select[name="priority"]').selectOption("HIGH");

    // Apply filter
    await page.locator('button:has-text("Filter")').click();

    // URL harus berubah
    await expect(page).toHaveURL(/status=PENDING/);
    await expect(page).toHaveURL(/priority=HIGH/);
  });

  test("harus bisa search work orders", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Search
    await page.locator('input[name="search"]').fill("maintenance");
    await page.locator('button:has-text("Search")').click();

    // URL harus berubah
    await expect(page).toHaveURL(/search=maintenance/);
  });

  test("harus bisa add comment ke work order", async ({ page }) => {
    await page.goto("/admin/work-orders");

    // Click first work order
    await page.locator("table tbody tr").first().click();

    // Scroll to comments section
    await page.locator('textarea[name="comment"]').scrollIntoViewIfNeeded();

    // Add comment
    await page.locator('textarea[name="comment"]').fill("Test comment");
    await page.locator('button:has-text("Add Comment")').click();

    // Harus muncul comment
    await expect(page.locator("text=Test comment")).toBeVisible();
  });
});
