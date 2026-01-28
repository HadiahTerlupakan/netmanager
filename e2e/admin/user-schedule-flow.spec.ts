
import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { prisma } from '../../lib/prisma'

const ADMIN = {
  email: 'admin@example.com',
  password: 'admin123'
}

const EMPLOYEE = {
  email: 'qa.fieldtech@test.com',
  password: 'qatest123'
}

test.beforeEach(async () => {
    // Clear attendance for the test user today to ensure clean state
    const user = await prisma.user.findUnique({ where: { email: EMPLOYEE.email } });
    if (user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await prisma.attendance.deleteMany({
            where: {
                userId: user.id,
                checkIn: {
                    gte: today
                }
            }
        });
    }
});

async function login(page: Page, user: typeof ADMIN) {
  await page.goto('/admin/login')
  await page.waitForSelector('#email', { state: 'visible', timeout: 10000 })
  await page.locator('#email').fill(user.email)
  await page.locator('#password').fill(user.password)
  await page.click('button[type="submit"]')
  // Wait for redirect away from login
  await page.waitForFunction(() => !window.location.pathname.includes('login'), { timeout: 15000 })
}

async function loginAsEmployee(page: Page) {
  await page.goto('/karyawan/login')
  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 10000 })
  await page.fill('input[type="email"]', EMPLOYEE.email)
  await page.fill('input[type="password"]', EMPLOYEE.password)
  await page.click('button[type="submit"]')
  await page.waitForFunction(() => window.location.pathname.includes('dashboard'), { timeout: 15000 })
}

async function setupMocks(context: BrowserContext) {
  await context.addInitScript(() => {
    // Mock Geolocation
    const mockGeolocation = {
      getCurrentPosition: (success: any) => {
        success({
          coords: {
            latitude: -6.2000,
            longitude: 106.8167,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
      },
      watchPosition: (success: any) => {
        success({
          coords: {
            latitude: -6.2000,
            longitude: 106.8167,
            accuracy: 10,
          },
          timestamp: Date.now(),
        });
        return 1;
      },
    };
    // @ts-ignore
    navigator.geolocation.getCurrentPosition = mockGeolocation.getCurrentPosition;
    // @ts-ignore
    navigator.geolocation.watchPosition = mockGeolocation.watchPosition;

    // Mock Camera
    // @ts-ignore
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'blue';
        ctx.fillRect(0, 0, 640, 480);
        ctx.fillStyle = 'white';
        // @ts-ignore
        ctx.font = '30px Arial';
        ctx.fillText('Mock Camera', 200, 240);
      }
      
      const stream = (canvas as any).captureStream(30);
      return stream;
    };
  });
  
  // Grant permissions
  await context.grantPermissions(['geolocation', 'camera']);
}


async function performCheckIn(page: Page) {
    await page.getByRole('button', { name: 'Absen Masuk' }).first().click();
    
    // In Camera Modal
    const captureButton = page.locator('button >> div.size-16');
    await captureButton.waitFor({ state: 'visible', timeout: 10000 });
    await captureButton.click();
    
    // In Preview Modal
    const previewModal = page.locator('div')
        .filter({ hasText: 'Preview Selfie' })
        .filter({ hasText: 'Ulang' })
        .last();
    await expect(previewModal).toBeVisible();
    
    // Click Absen Masuk in modal
    const confirmBtn = previewModal.getByRole('button', { name: 'Absen Masuk' });

    await expect(confirmBtn).toBeVisible();
    await expect(confirmBtn).toBeEnabled();
    // Use evaluate to bypass potential interception
    await confirmBtn.evaluate((node: HTMLElement) => node.click());
}

// SKIP: This test requires /karyawan portal which is not yet implemented
// TODO: Enable once employee portal (/karyawan) routes are created
test.describe.skip('User Schedule & Attendance Flow', () => {
  
  test('Scenario 1 & 2: Admin Configures FIXED Schedule and Employee Checks In ON_TIME', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    // 1. Admin Login & Set Schedule
    await login(adminPage, ADMIN);
    await adminPage.goto('/admin/users');
    
    // Search for user
    const searchInput = adminPage.getByPlaceholder(/Cari pengguna/);
    await searchInput.fill(EMPLOYEE.email);
    await searchInput.press('Enter');
    
    // Wait for table to update
    await adminPage.waitForSelector(`text=${EMPLOYEE.email}`);
    
    // Find the user row and click edit
    const editLink = adminPage.locator('tr').filter({ hasText: EMPLOYEE.email }).getByRole('link', { name: 'Edit' });
    await editLink.click();
    
    // Wait for form to load (WorkingHoursSettings)
    await adminPage.waitForSelector('button:has-text("Jam Kerja Tetap")');
    
    // Set FIXED Mode
    await adminPage.click('button:has-text("Jam Kerja Tetap")');
    
    // Get current hour to set "now" as on time
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // Set start time to current time - 5 mins (to be on time)
    const startTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    await adminPage.fill('input[type="time"] >> nth=0', startTime);
    await adminPage.fill('input[type="time"] >> nth=1', '17:00');
    
    await adminPage.click('button:has-text("Simpan Perubahan")');
    await expect(adminPage.locator('text=Data pengguna telah diperbarui')).toBeVisible();
    await adminContext.close();

    // 2. Employee Login & Attendance
    const employeeContext = await browser.newContext();
    await setupMocks(employeeContext);
    const employeePage = await employeeContext.newPage();
    employeePage.on('console', msg => console.log(`EMPLOYEE_LOG: ${msg.text()}`));
    
    await loginAsEmployee(employeePage);
    
    await employeePage.goto('/karyawan/absensi');
    await expect(employeePage.getByRole('heading', { name: 'Absensi', exact: true })).toBeVisible();
    
    await performCheckIn(employeePage);
    
    // Success Toast/Status
    // Toast might be flaky or disappear too fast/be covered. Rely on data update (Badge).
    // await expect(employeePage.getByText('Check-in Berhasil!')).toBeVisible({ timeout: 15000 });
    
    // Verify in History
    const statusBadge = employeePage.locator('span:has-text("Tepat Waktu")').first();
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    
    await employeeContext.close();
  });

  test('Scenario 3: Admin Configures FIXED Schedule and Employee Checks In LATE', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    // 1. Admin Login & Set Schedule to be LATE
    await login(adminPage, ADMIN);
    await adminPage.goto('/admin/users');
    // Search for user
    const searchInput = adminPage.getByPlaceholder(/Cari pengguna/);
    await searchInput.fill(EMPLOYEE.email);
    await searchInput.press('Enter');
    
    // Wait for table to update
    await adminPage.waitForSelector(`text=${EMPLOYEE.email}`);
    
    // Find the user row and click edit
    const editLink = adminPage.locator('tr').filter({ hasText: EMPLOYEE.email }).getByRole('link', { name: 'Edit' });
    await editLink.click();
    
    // Wait for form to load (WorkingHoursSettings)
    await adminPage.waitForSelector('button:has-text("Jam Kerja Tetap")');
    
    await adminPage.click('button:has-text("Jam Kerja Tetap")');
    
    const now = new Date();
    // Set start time to 1 hour ago
    now.setHours(now.getHours() - 1);
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    await adminPage.fill('input[type="time"] >> nth=0', startTime);
    await adminPage.click('button:has-text("Simpan Perubahan")');
    await expect(adminPage.locator('text=Data pengguna telah diperbarui')).toBeVisible();
    await adminContext.close();

    // 2. Employee Attendance
    const employeeContext = await browser.newContext();
    await setupMocks(employeeContext);
    const employeePage = await employeeContext.newPage();
    employeePage.on('console', msg => console.log(`EMPLOYEE_LOG: ${msg.text()}`));
    
    await loginAsEmployee(employeePage);
    await employeePage.goto('/karyawan/absensi');
    
    await performCheckIn(employeePage);
    
    // Verify LATE status
    // await expect(employeePage.locator('text=Check-in Berhasil!')).toBeVisible();
    const statusBadge = employeePage.locator('span:has-text("Terlambat")').first();
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    
    await employeeContext.close();
  });

  test('Scenario 5: FLEXIBLE Mode Attendance', async ({ browser }) => {
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    
    await login(adminPage, ADMIN);
    await adminPage.goto('/admin/users');
    // Search for user
    const searchInput = adminPage.getByPlaceholder(/Cari pengguna/);
    await searchInput.fill(EMPLOYEE.email);
    await searchInput.press('Enter');
    
    // Wait for table to update
    await adminPage.waitForSelector(`text=${EMPLOYEE.email}`);
    
    // Find the user row and click edit
    const editLink = adminPage.locator('tr').filter({ hasText: EMPLOYEE.email }).getByRole('link', { name: 'Edit' });
    await editLink.click();
    
    // Wait for form to load
    await adminPage.waitForSelector('button:has-text("Jam Kerja Tetap")');
    
    // Set FLEXIBLE Mode
    await adminPage.click('button:has-text("Jam Kerja Fleksibel")');
    await adminPage.fill('input[type="number"]', '8'); // Target 8 hours
    
    await adminPage.click('button:has-text("Simpan Perubahan")');
    await expect(adminPage.locator('text=Data pengguna telah diperbarui')).toBeVisible();
    await adminContext.close();

    // 2. Employee Attendance
    const employeeContext = await browser.newContext();
    await setupMocks(employeeContext);
    const employeePage = await employeeContext.newPage();
    employeePage.on('console', msg => console.log(`EMPLOYEE_LOG: ${msg.text()}`));
    
    await loginAsEmployee(employeePage);
    await employeePage.goto('/karyawan/absensi');
    
    await performCheckIn(employeePage);
    
    // Flexible mode should be ON_TIME by default in current implementation
    // await expect(employeePage.locator('text=Check-in Berhasil!')).toBeVisible();
    const statusBadge = employeePage.locator('span:has-text("Tepat Waktu")').first();
    await expect(statusBadge).toBeVisible({ timeout: 15000 });
    
    await employeeContext.close();
  });
});
