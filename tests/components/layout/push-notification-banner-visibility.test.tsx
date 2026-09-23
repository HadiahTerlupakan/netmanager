import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const pushNotificationFiles = [
  "components/notifications/PushNotificationManager.tsx",
  "components/karyawan/KaryawanPushNotification.tsx",
];

/**
 * ESLint programatik memuat konfigurasi type-aware, jadi seluruh program
 * TypeScript proyek ikut dibangun sebelum dua berkas ini diperiksa. Di runner
 * CI itu memakan 54 detik (run Gitea task 202, 2026-09-23) dan menembus
 * `testTimeout` global 30 detik (`vitest.config.ts`), sehingga deploy gagal
 * tanpa ada pelanggaran lint. Batas tersendiri ini hanya untuk test ini.
 */
const BATAS_WAKTU_LINT_MS = 180_000;

describe("push notification banner lint safety", () => {
  it(
    "keeps push notification components free from set-state-in-effect violations",
    {
      timeout: BATAS_WAKTU_LINT_MS,
    },
    async () => {
      const eslint = new ESLint({ cwd: process.cwd() });
      const results = await eslint.lintFiles(pushNotificationFiles);

      const violations = results.flatMap((result) =>
        result.messages
          .filter(
            (message) => message.ruleId === "react-hooks/set-state-in-effect",
          )
          .map(
            (message) =>
              `${result.filePath}:${message.line}:${message.column} ${message.message}`,
          ),
      );

      expect(violations).toEqual([]);
    },
  );
});
