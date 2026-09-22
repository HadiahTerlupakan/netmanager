/**
 * Centralized Permission Constants
 * Use these constants instead of raw strings to prevent typos and ensure consistency.
 */

export const PERMISSIONS = {
  DASHBOARD: {
    READ: "dashboard:read",
  },
  SYSTEM_LOG: {
    READ: "system_log:read",
    SITE_ONLY: "system_log:site_only",
  },
  SUPPORT: {
    READ: "support:read",
    REPLY: "support:reply",
    CLOSE: "support:close",
    DELETE: "support:delete",
  },
  WORK_ORDER: {
    READ: "workorders:read",
    CREATE: "workorders:create",
    UPDATE: "workorders:update",
    DELETE: "workorders:delete",
    ASSIGN: "workorders:assign",
    APPROVE: "workorders:approve",
    REQUESTS_READ: "workorders:requests:read",
    SITE_ONLY: "workorders:site_only",
    DEPARTMENT_ONLY: "workorders:department_only",
  },
  INVENTORY: {
    BARANG: {
      READ: "barang:read",
      CREATE: "barang:create",
      UPDATE: "barang:update",
      DELETE: "barang:delete",
      SITE_ONLY: "barang:site_only",
    },
    GUDANG: {
      READ: "gudang:read",
      CREATE: "gudang:create",
      UPDATE: "gudang:update",
      DELETE: "gudang:delete",
      SITE_ONLY: "gudang:site_only",
    },
    MASUK: {
      READ: "masuk:read",
      CREATE: "masuk:create",
      SITE_ONLY: "masuk:site_only",
    },
    KELUAR: {
      READ: "keluar:read",
      CREATE: "keluar:create",
      SITE_ONLY: "keluar:site_only",
    },
    OPNAME: {
      READ: "opname:read",
      CREATE: "opname:create",
      SITE_ONLY: "opname:site_only",
    },
    TRANSFER: {
      READ: "transfer:read",
      CREATE: "transfer:create",
      SITE_ONLY: "transfer:site_only",
    },
  },
  FINANCE: {
    EXPENSE: {
      READ: "expense:read",
      CREATE: "expense:create",
      UPDATE: "expense:update",
      DELETE: "expense:delete",
      SITE_ONLY: "expense:site_only",
    },
  },
  ATTENDANCE: {
    LEAVE: {
      READ: "izin:read",
      CREATE: "izin:create",
      VERIFY: "izin:verify",
      DELETE: "izin:delete",
      SITE_ONLY: "izin:site_only",
      DEPARTMENT_ONLY: "izin:department_only",
    },
    LIVE_TRACKING: {
      READ: "live_tracking:read",
      SITE_ONLY: "live_tracking:site_only",
      DEPARTMENT_ONLY: "live_tracking:department_only",
    },
  },
  APP_RELEASE: {
    MANAGE: "app-release:manage",
  },
  SETTINGS: {
    ROLES: {
      READ: "role:read",
      CREATE: "role:create",
      UPDATE: "role:update",
      DELETE: "role:delete",
    },
    ACS: {
      READ: "acs:read",
      CREATE: "acs:create",
      UPDATE: "acs:update",
      DELETE: "acs:delete",
    },
  },
  MARKETING: {
    SALES: {
      READ: "sales:read",
      CREATE: "sales:create",
      UPDATE: "sales:update",
      DELETE: "sales:delete",
      SITE_ONLY: "sales:site_only",
    },
    SALES_DASHBOARD: {
      READ: "sales_dashboard:read",
      SITE_ONLY: "sales_dashboard:site_only",
    },
    CANVASING: {
      READ: "canvasing:read",
      CREATE: "canvasing:create",
      UPDATE: "canvasing:update",
      DELETE: "canvasing:delete",
      VERIFY: "canvasing:verify",
      SITE_ONLY: "canvasing:site_only",
    },
    PRESURVEI: {
      READ: "presurvei:read",
      CREATE: "presurvei:create",
      UPDATE: "presurvei:update",
      DELETE: "presurvei:delete",
      SITE_ONLY: "presurvei:site_only",
    },
  },
  PLANNING: {
    READ: "planning:read",
    CREATE: "planning:create",
    UPDATE: "planning:update",
    DELETE: "planning:delete",
    APPROVE: "planning:approve",
    SUBMIT: "planning:approve_request",
  },
} as const;
