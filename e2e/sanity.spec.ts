import { test, expect } from '@playwright/test';

test.describe('Sanity Check', () => {
  test('should allow user to login and view dashboard', async ({ page }) => {
    // 1. Visit Login Page
    await page.goto('/admin/login');

    // Check if we are redirected or on login page
    await expect(page).toHaveTitle(/NetManager/);

    // 2. Fill Login Form
    // Try to find email input by various selectors
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.locator('button[type="submit"]');

    await emailInput.fill('admin@example.com');
    await passwordInput.fill('admin123');
    await submitButton.click();

    // 3. Verify Dashboard Load
    // Wait for navigation to dashboard or admin root
    await page.waitForURL(/.*\/admin/, { timeout: 10000 });

    // Check key elements on dashboard (Dashboard usually has Overview or Summary)
    // Adjust selector to be more generic if "Dashboard" text is not h1
    await expect(page.locator('body')).toContainText('NetManager');

    // Check if sidebar/navigation exists
    const sidebar = page.locator('aside'); // Usually aside is sidebar
    await expect(sidebar).toBeVisible();
  });
});
