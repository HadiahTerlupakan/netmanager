import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      role?: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
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

  interface User {
    id: string
    email: string
    name?: string | null
    role: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
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
    role?: 'USER' | 'ADMIN' | 'FINANCE' | 'HR'
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

