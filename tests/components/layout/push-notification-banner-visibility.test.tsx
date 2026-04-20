import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const pushNotificationFiles = [
  "components/notifications/PushNotificationManager.tsx",
  "components/karyawan/KaryawanPushNotification.tsx",
];

describe("push notification banner lint safety", () => {
  it("keeps push notification components free from set-state-in-effect violations", async () => {
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
  });
});
