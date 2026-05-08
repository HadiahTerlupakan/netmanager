import { test, expect } from "@playwright/test";

/**
 * Test untuk mendeteksi N+1 query problem pada permission fetching
 * dan time issue yang dilaporkan user
 */

test.describe("Permission N+1 Query Investigation", () => {
  test.beforeEach(async ({ page }) => {
    // Track semua network requests
    await page.route("**/*", async (route) => {
      await route.continue();
    });
  });

  test("should not call getUserPermissions multiple times on page load", async ({
    page,
  }) => {
    const permissionCalls: Array<{ url: string; timestamp: number }> = [];
    const allRequests: Array<{
      url: string;
      method: string;
      timestamp: number;
    }> = [];

    // Monitor semua network requests
    page.on("request", (request) => {
      const url = request.url();
      const timestamp = Date.now();

      allRequests.push({
        url,
        method: request.method(),
        timestamp,
      });

      // Track calls yang mungkin trigger getUserPermissions
      if (
        url.includes("/api/") &&
        !url.includes("_next") &&
        !url.includes("static")
      ) {
        console.log(
          `[${new Date(timestamp).toISOString()}] ${request.method()} ${url}`,
        );
      }
    });

    // Monitor console logs dari server
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.includes("getUserPermissions") || text.includes("PERMISSION")) {
        console.log(`[CONSOLE] ${text}`);
        permissionCalls.push({
          url: "console-log",
          timestamp: Date.now(),
        });
      }
    });

    // Login
    await page.goto("http://localhost:3000/admin/login");
    await page.fill("input#email", "admin@example.com");
    await page.fill("input#password", "admin123");
    await page.click('button[type="submit"]');

    // Wait for redirect after login
    await page.waitForURL("**/admin/**", { timeout: 10000 });

    // Navigate ke halaman yang punya dropdown site filter
    await page.goto("http://localhost:3000/admin/attendance");
    await page.waitForLoadState("networkidle");

    // Tunggu sebentar untuk capture semua requests
    await page.waitForTimeout(2000);

    // Analyze requests
    const apiRequests = allRequests.filter(
      (req) =>
        req.url.includes("/api/") &&
        !req.url.includes("_next") &&
        !req.url.includes("static"),
    );

    console.log("\n=== API Requests Summary ===");
    console.log(`Total API requests: ${apiRequests.length}`);

    // Group by endpoint
    const requestsByEndpoint = apiRequests.reduce(
      (acc, req) => {
        const endpoint = new URL(req.url).pathname;
        if (!acc[endpoint]) {
          acc[endpoint] = [];
        }
        acc[endpoint].push(req);
        return acc;
      },
      {} as Record<string, typeof apiRequests>,
    );

    console.log("\n=== Requests by Endpoint ===");
    Object.entries(requestsByEndpoint).forEach(([endpoint, requests]) => {
      console.log(`${endpoint}: ${requests.length} calls`);
      if (requests.length > 1) {
        console.log("  Timestamps:");
        requests.forEach((req, idx) => {
          console.log(
            `    ${idx + 1}. ${new Date(req.timestamp).toISOString()}`,
          );
        });
      }
    });

    console.log("\n=== Permission Calls ===");
    console.log(`Total permission-related calls: ${permissionCalls.length}`);
    permissionCalls.forEach((call, idx) => {
      console.log(
        `${idx + 1}. [${new Date(call.timestamp).toISOString()}] ${call.url}`,
      );
    });

    // Check JWT token
    const cookies = await page.context().cookies();
    const sessionToken = cookies.find(
      (c) =>
        c.name === "next-auth.session-token" ||
        c.name === "__Secure-next-auth.session-token",
    );

    if (sessionToken) {
      console.log("\n=== Session Token Found ===");
      console.log(`Token length: ${sessionToken.value.length}`);
    } else {
      console.log("\n=== No Session Token Found ===");
    }

    // Assertions
    expect(apiRequests.length).toBeGreaterThan(0);

    // Jika ada endpoint yang dipanggil lebih dari 1x, itu indikasi masalah
    const duplicateEndpoints = Object.entries(requestsByEndpoint).filter(
      ([_, requests]) => requests.length > 1,
    );

    if (duplicateEndpoints.length > 0) {
      console.log("\n⚠️  WARNING: Duplicate endpoint calls detected:");
      duplicateEndpoints.forEach(([endpoint, requests]) => {
        console.log(`  ${endpoint}: ${requests.length} calls`);
      });
    }
  });

  test("should check JWT token contains permissions array", async ({
    page,
  }) => {
    // Login
    await page.goto("http://localhost:3000/admin/login");
    await page.fill("input#email", "admin@example.com");
    await page.fill("input#password", "admin123");

    // Intercept the login API call
    const loginResponse = page.waitForResponse((response) =>
      response.url().includes("/api/auth/callback/credentials"),
    );

    await page.click('button[type="submit"]');
    await loginResponse;

    // Wait for redirect
    await page.waitForURL("**/admin/**", { timeout: 10000 });

    // Check cookies
    const cookies = await page.context().cookies();
    const sessionToken = cookies.find(
      (c) =>
        c.name === "next-auth.session-token" ||
        c.name === "__Secure-next-auth.session-token",
    );

    console.log("\n=== JWT Token Analysis ===");
    if (sessionToken) {
      console.log("✓ Session token found");
      console.log(`Token length: ${sessionToken.value.length} chars`);
      console.log(`Token preview: ${sessionToken.value.substring(0, 50)}...`);

      // Decode JWT (basic check - just split by dots)
      const parts = sessionToken.value.split(".");
      console.log(
        `JWT parts: ${parts.length} (should be 3: header.payload.signature)`,
      );

      if (parts.length >= 3) {
        try {
          // JWT standard: parts[0] = header, parts[1] = payload, parts[2] = signature
          // Decode payload (base64url)
          const payloadPart = parts[1];
          console.log(`\nPayload part length: ${payloadPart.length}`);

          const payload = Buffer.from(payloadPart, "base64").toString("utf-8");
          const parsed = JSON.parse(payload);

          console.log("\n=== JWT Payload ===");
          console.log("Keys:", Object.keys(parsed));

          if (parsed.permissions) {
            console.log("✓ Permissions found in JWT");
            console.log(
              `  Type: ${Array.isArray(parsed.permissions) ? "array" : typeof parsed.permissions}`,
            );
            console.log(
              `  Count: ${Array.isArray(parsed.permissions) ? parsed.permissions.length : "N/A"}`,
            );
            if (
              Array.isArray(parsed.permissions) &&
              parsed.permissions.length > 0
            ) {
              console.log(
                `  Sample: ${parsed.permissions.slice(0, 3).join(", ")}`,
              );
            }
          } else {
            console.log("✗ Permissions NOT found in JWT");
          }

          if (parsed.permissionsCount !== undefined) {
            console.log(`✓ permissionsCount: ${parsed.permissionsCount}`);
          }
        } catch (e) {
          console.log("Failed to decode JWT payload:", e);
        }
      }
    } else {
      console.log("✗ No session token found");
    }

    expect(sessionToken).toBeDefined();
  });

  test("should measure time between requests", async ({ page }) => {
    const requestTimings: Array<{
      url: string;
      method: string;
      startTime: number;
      endTime?: number;
      duration?: number;
    }> = [];

    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("/api/") &&
        !url.includes("_next") &&
        !url.includes("static")
      ) {
        requestTimings.push({
          url,
          method: request.method(),
          startTime: Date.now(),
        });
      }
    });

    page.on("response", (response) => {
      const url = response.url();
      if (
        url.includes("/api/") &&
        !url.includes("_next") &&
        !url.includes("static")
      ) {
        const timing = requestTimings.find((t) => t.url === url && !t.endTime);
        if (timing) {
          timing.endTime = Date.now();
          timing.duration = timing.endTime - timing.startTime;
        }
      }
    });

    // Login
    await page.goto("http://localhost:3000/admin/login");
    await page.fill("input#email", "admin@example.com");
    await page.fill("input#password", "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/admin/**", { timeout: 10000 });

    // Navigate to attendance page
    await page.goto("http://localhost:3000/admin/attendance");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Analyze timings
    console.log("\n=== Request Timings ===");
    const completedTimings = requestTimings.filter(
      (t) => t.duration !== undefined,
    );

    completedTimings.forEach((timing) => {
      const endpoint = new URL(timing.url).pathname;
      console.log(`${endpoint}: ${timing.duration}ms`);
    });

    // Check for slow requests
    const slowRequests = completedTimings.filter((t) => t.duration! > 500);
    if (slowRequests.length > 0) {
      console.log("\n⚠️  Slow requests (>500ms):");
      slowRequests.forEach((timing) => {
        const endpoint = new URL(timing.url).pathname;
        console.log(`  ${endpoint}: ${timing.duration}ms`);
      });
    }

    // Check time gaps between requests
    const sortedTimings = completedTimings.sort(
      (a, b) => a.startTime - b.startTime,
    );
    console.log("\n=== Time Gaps Between Requests ===");
    for (let i = 1; i < sortedTimings.length; i++) {
      const gap = sortedTimings[i].startTime - sortedTimings[i - 1].startTime;
      const prevEndpoint = new URL(sortedTimings[i - 1].url).pathname;
      const currEndpoint = new URL(sortedTimings[i].url).pathname;
      console.log(`${prevEndpoint} → ${currEndpoint}: ${gap}ms gap`);
    }
  });
});
