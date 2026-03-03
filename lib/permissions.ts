/**
 * Centralized Permission Constants
 * Use these constants instead of raw strings to prevent typos and ensure consistency.
 */

export const PERMISSIONS = {
  DASHBOARD: {
    READ: 'dashboard:read',
  },
  SYSTEM_LOG: {
    READ: 'system_log:read',
    SITE_ONLY: 'system_log:site_only',
  },
  SUPPORT: {
    READ: 'support:read',
    REPLY: 'support:reply',
    CLOSE: 'support:close',
    DELETE: 'support:delete',
  },
  WORK_ORDER: {
    READ: 'workorders:read',
    CREATE: 'workorders:create',
    UPDATE: 'workorders:update',
    DELETE: 'workorders:delete',
    ASSIGN: 'workorders:assign',
    APPROVE: 'workorders:approve',
    REQUESTS_READ: 'workorders:requests:read',
    SITE_ONLY: 'workorders:site_only',
    DEPARTMENT_ONLY: 'workorders:department_only',
  },
  INVENTORY: {
    BARANG: {
      READ: 'barang:read',
      CREATE: 'barang:create',
      UPDATE: 'barang:update',
      DELETE: 'barang:delete',
      SITE_ONLY: 'barang:site_only',
    },
    GUDANG: {
      READ: 'gudang:read',
      CREATE: 'gudang:create',
      UPDATE: 'gudang:update',
      DELETE: 'gudang:delete',
      SITE_ONLY: 'gudang:site_only',
    },
    MASUK: {
      READ: 'masuk:read',
      CREATE: 'masuk:create',
      SITE_ONLY: 'masuk:site_only',
    },
    KELUAR: {
      READ: 'keluar:read',
      CREATE: 'keluar:create',
      SITE_ONLY: 'keluar:site_only',
    },
    OPNAME: {
      READ: 'opname:read',
      CREATE: 'opname:create',
      SITE_ONLY: 'opname:site_only',
    },
    TRANSFER: {
      READ: 'transfer:read',
      CREATE: 'transfer:create',
      SITE_ONLY: 'transfer:site_only',
    }
  },
  MIXRADIUS: {
    GENERIC: {
      READ: 'mixradius:read',
      CREATE: 'mixradius:create',
      UPDATE: 'mixradius:update',
      DELETE: 'mixradius:delete',
    },
    ACCOUNTS: {
      READ: 'mixradius_accounts:read',
      CREATE: 'mixradius_accounts:create',
      UPDATE: 'mixradius_accounts:update',
      DELETE: 'mixradius_accounts:delete',
    },
    SITES: {
      READ: 'mixradius_sites:read',
      CREATE: 'mixradius_sites:create',
      UPDATE: 'mixradius_sites:update',
      DELETE: 'mixradius_sites:delete',
    },
    EXPENSES: {
      READ: 'mixradius_expenses:read',
      CREATE: 'mixradius_expenses:create',
      UPDATE: 'mixradius_expenses:update',
      DELETE: 'mixradius_expenses:delete',
    },
    INCOME: {
      READ: 'mixradius_income:read',
      DELETE: 'mixradius_income:delete',
    },
    ISOLIR: {
      READ: 'mixradius_isolir:read',
      UPDATE: 'mixradius_isolir:update',
    }
  },
  FINANCE: {
    EXPENSE: {
      READ: 'expense:read',
      CREATE: 'expense:create',
      UPDATE: 'expense:update',
      DELETE: 'expense:delete',
      SITE_ONLY: 'expense:site_only',
    }
  },
  ATTENDANCE: {
    LEAVE: {
      READ: 'izin:read',
      CREATE: 'izin:create',
      VERIFY: 'izin:verify',
      DELETE: 'izin:delete',
      SITE_ONLY: 'izin:site_only',
      DEPARTMENT_ONLY: 'izin:department_only',
    },
    LIVE_TRACKING: {
      READ: 'live_tracking:read',
      SITE_ONLY: 'live_tracking:site_only',
      DEPARTMENT_ONLY: 'live_tracking:department_only',
    }
  },
  SETTINGS: {
    ROLES: {
      READ: 'role:read',
      CREATE: 'role:create',
      UPDATE: 'role:update',
      DELETE: 'role:delete',
    },
    ACS: {
      READ: 'acs:read',
      CREATE: 'acs:create',
      UPDATE: 'acs:update',
      DELETE: 'acs:delete',
    }
  }
} as const;
