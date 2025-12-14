import { z } from 'zod'

export const employeeCreateSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID wajib diisi'),
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi'),
  email: z.string().trim().optional().refine(val => !val || val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Format email tidak valid'
  }),
  phone: z.string().trim().optional().or(z.literal('')),
  departmentId: z.string().trim().optional().or(z.literal('')),
  positionId: z.string().trim().optional().or(z.literal('')),
  siteId: z.string().trim().optional().or(z.literal('')),
  joinDate: z.string().transform(val => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).default('ACTIVE'),
  isActive: z.boolean().default(true),
  userId: z.string().trim().optional().or(z.literal('')),
  
  // Personal Information
  dateOfBirth: z.string().transform(val => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  idCardNumber: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  city: z.string().trim().optional().or(z.literal('')),
  province: z.string().trim().optional().or(z.literal('')),
  
  // Employment Details
  employmentStatus: z.enum(['PROBATION', 'PERMANENT', 'CONTRACT']).default('PROBATION'),
  probationEndDate: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  
  // Bank Information
  bankName: z.string().trim().optional().or(z.literal('')),
  bankAccountNumber: z.string().trim().optional().or(z.literal('')),
  bankAccountName: z.string().trim().optional().or(z.literal('')),
  npwp: z.string().trim().optional().or(z.literal('')),
  
  // Emergency Contact
  emergencyName: z.string().trim().optional().or(z.literal('')),
  emergencyPhone: z.string().trim().optional().or(z.literal('')),
  emergencyRelation: z.string().trim().optional().or(z.literal('')),
})

export const employeeUpdateSchema = z.object({
  employeeId: z.string().trim().min(1, 'Employee ID wajib diisi').optional(),
  fullName: z.string().trim().min(1, 'Nama lengkap wajib diisi').optional(),
  email: z.string().trim().optional().refine(val => !val || val === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: 'Format email tidak valid'
  }).transform(val => val === '' ? undefined : val),
  phone: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  departmentId: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  positionId: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  siteId: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  joinDate: z.string().transform(val => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  isActive: z.boolean().optional(),
  userId: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  
  // Personal Information
  dateOfBirth: z.string().transform(val => val ? new Date(val) : undefined).optional(),
  gender: z.enum(['MALE', 'FEMALE']).optional(),
  idCardNumber: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  address: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  city: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  province: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  
  // Employment Details
  employmentStatus: z.enum(['PROBATION', 'PERMANENT', 'CONTRACT']).optional(),
  probationEndDate: z.string().transform(val => {
    if (!val) return undefined;
    const date = new Date(val);
    return isNaN(date.getTime()) ? undefined : date;
  }).optional(),
  
  // Bank Information
  bankName: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  bankAccountNumber: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  bankAccountName: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  npwp: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  
  // Emergency Contact
  emergencyName: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  emergencyPhone: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
  emergencyRelation: z.string().trim().optional().or(z.literal('').transform(() => undefined)),
})

export const employeeQuerySchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).default(1),
  limit: z.string().transform(val => parseInt(val) || 10).default(10),
  search: z.string().trim().optional().or(z.literal('')),
  departmentId: z.string().trim().optional().or(z.literal('')),
  positionId: z.string().trim().optional().or(z.literal('')),
  siteId: z.string().trim().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  isActive: z.enum(['true', 'false']).transform(val => val === 'true').optional(),
  sortBy: z.enum(['employeeId', 'fullName', 'joinDate', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})