import { describe, expect, it } from "vitest";
import {
  buildTenantSqlCondition,
  getMissingTenantId,
} from "@/modules/notification/services/NotificationService.helpers";

describe("notification unread count tenant filtering", () => {
  it("uses the missing tenant sentinel when non-superadmin context has no tenant id", () => {
    const condition = buildTenantSqlCondition(false, null);

    expect(condition.values).toEqual([getMissingTenantId()]);
  });
});
