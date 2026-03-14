import "next-auth";

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
      employeeId?: string
      role?: string
      accessAdminPanel?: boolean
      accessEmployeePanel?: boolean
      permissions?: string[]
      /** @deprecated Use siteIds for multi-site */
      siteId?: string
      siteIds?: string[]
      primarySiteId?: string
      isSuperAdmin?: boolean
      tenantId?: string | null
      departmentId?: string
      departmentName?: string
      canApproveRab?: boolean
      employee?: {
        id: string
        employeeId: string
        fullName: string
        department?: { id: string; name: string } | null
        position?: { id: string; title: string } | null
      }
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    employeeId?: string
    role?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    permissions?: string[]
    siteIds?: string[]
    isSuperAdmin?: boolean
    tenantId?: string | null
    canApproveRab?: boolean
    employee?: {
      id: string
      employeeId: string
      fullName: string
      department?: { id: string; name: string } | null
      position?: { id: string; title: string } | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    employeeId?: string
    role?: string
    accessAdminPanel?: boolean
    accessEmployeePanel?: boolean
    permissions?: string[]
    siteId?: string
    siteIds?: string[]
    primarySiteId?: string
    departmentId?: string
    tenantId?: string | null
    isSuperAdmin?: boolean
    canApproveRab?: boolean
    employee?: {
      id: string
      employeeId: string
      fullName: string
      department?: { id: string; name: string } | null
      position?: { id: string; title: string } | null
    }
  }
}
