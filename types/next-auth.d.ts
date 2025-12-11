import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      role?: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
      employeeId?: string
      customRoleId?: string
      customRole?: {
        id: string
        name: string
        code: string
        description?: string | null
        allowedFeatures?: string | null
        priority?: number
        isActive?: boolean
      }
      employee?: {
        id: string
        employeeId: string
        fullName: string
        department?: { id: string; name: string } | null
        position?: { id: string; title: string } | null
      }
      permissions?: string[]
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
    employeeId?: string
    customRoleId?: string
    customRole?: {
      id: string
      name: string
      code: string
      description?: string | null
      allowedFeatures?: string | null
      priority?: number
      isActive?: boolean
    }
    employee?: {
      id: string
      employeeId: string
      fullName: string
      department?: { id: string; name: string } | null
      position?: { id: string; title: string } | null
    }
    permissions?: string[]
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    role?: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
    employeeId?: string
    customRoleId?: string
    customRole?: {
      id: string
      name: string
      code: string
      description?: string | null
      allowedFeatures?: string | null
      priority?: number
      isActive?: boolean
    }
    employee?: {
      id: string
      employeeId: string
      fullName: string
      department?: { id: string; name: string } | null
      position?: { id: string; title: string } | null
    }
    permissions?: string[]
  }
}

