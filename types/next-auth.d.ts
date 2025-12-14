import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      employeeId?: string
      role?: string
      permissions?: string[]
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
    permissions?: string[]
    employee?: {
      id: string
      employeeId: string
      fullName: string
      department?: { id: string; name: string } | null
      position?: { id: string; title: string } | null
    }
  }
}
