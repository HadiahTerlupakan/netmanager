import * as z from "zod";

// Common base schemas
const basePaginationSchema = {
  page: z.coerce.number().int().min(1, "Page must be at least 1").default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit cannot exceed 100")
    .default(20),
  search: z.string().max(255).optional(),
};

const baseDateRangeSchema = {
  startDate: z.iso.datetime({ error: "Invalid start date format" }).optional(),
  endDate: z.iso.datetime({ error: "Invalid end date format" }).optional(),
};

// Finance module schemas
export const financeAuthSchema = z.object({
  userId: z.string().min(1, "User ID is required").max(255),
  email: z.email({ error: "Invalid email format" }).max(255),
});

export const financePemasukanSchema = z.object({
  kategori: z.string().min(1, "Category is required").max(100),
  deskripsi: z.string().min(1, "Description is required").max(500),
  jumlah: z
    .number()
    .positive("Amount must be positive")
    .max(999999999.99, "Amount is too large"),
  tanggal: z.iso.datetime({ error: "Invalid date format" }),
  karyawanId: z.uuid({ error: "Invalid employee ID format" }).optional(),
});

export const financePengeluaranSchema = z.object({
  kategori: z.string().min(1, "Category is required").max(100),
  deskripsi: z.string().min(1, "Description is required").max(500),
  jumlah: z
    .number()
    .positive("Amount must be positive")
    .max(999999999.99, "Amount is too large"),
  tanggal: z.iso.datetime({ error: "Invalid date format" }),
  tipe: z.enum(["CAPEX", "OPEX"], {
    message: "Type must be CAPEX or OPEX",
  }),
  karyawanId: z.uuid({ error: "Invalid employee ID format" }).optional(),
});

// Customer management schemas
export const customerCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.email({ error: "Invalid email format" }).max(255).optional(),
  phone: z
    .string()
    .regex(/^[+]?[\d\s\-()]{10,20}$/, "Invalid phone number format")
    .optional(),
  address: z.string().max(500).optional(),
  kategori: z.enum(["REGULER", "NON_REGULER"]).default("REGULER"),
  nik: z
    .string()
    .regex(/^\d{16}$/, "NIK must be 16 digits")
    .optional(),
  nomorKk: z
    .string()
    .regex(/^\d{16}$/, "KK number must be 16 digits")
    .optional(),
});

export const customerUpdateSchema = customerCreateSchema.partial();

// Employee management schemas
export const employeeCreateSchema = z.object({
  nik: z.string().regex(/^\d{16}$/, "NIK must be 16 digits"),
  name: z.string().min(1, "Name is required").max(100),
  email: z.email({ error: "Invalid email format" }).max(255),
  phone: z
    .string()
    .regex(/^[+]?[\d\s\-()]{10,20}$/, "Invalid phone number format"),
  position: z.string().min(1, "Position is required").max(100),
  department: z.string().min(1, "Department is required").max(100),
  joinDate: z.iso.datetime({ error: "Invalid date format" }),
  salary: z
    .number()
    .positive("Salary must be positive")
    .max(999999999.99, "Salary is too large"),
  status: z
    .enum(["PROBATION", "PERMANENT", "CONTRACT", "TERMINATED"])
    .default("PROBATION"),
});

export const employeeUpdateSchema = employeeCreateSchema.partial();

// Tagihan/Billing schemas
export const tagihanCreateSchema = z.object({
  pelangganId: z.uuid({ error: "Invalid customer ID format" }),
  periode: z.string().min(1, "Period is required").max(20),
  deskripsi: z.string().min(1, "Description is required").max(500),
  jumlah: z
    .number()
    .positive("Amount must be positive")
    .max(999999999.99, "Amount is too large"),
  jatuhTempo: z.iso.datetime({ error: "Invalid due date format" }),
});

export const tagihanUpdateSchema = tagihanCreateSchema.partial();

// Package/Paket schemas
export const packageCreateSchema = z.object({
  name: z.string().min(1, "Package name is required").max(100),
  description: z.string().max(1000).optional(),
  price: z
    .number()
    .positive("Price must be positive")
    .max(999999999.99, "Price is too large"),
  bandwidth: z.string().regex(/^\d+/, "Bandwidth must be a number").optional(),
  speed: z.string().regex(/^\d+/, "Speed must be a number").optional(),
  duration: z.number().int().min(1, "Duration must be at least 1").max(365),
  durationUnit: z.enum(["HARI", "BULAN", "TAHUN"]).default("BULAN"),
});

export const packageUpdateSchema = packageCreateSchema.partial();

// Radius/Network schemas
export const radiusAccountSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(255),
  email: z.email({ error: "Invalid email format" }).max(255).optional(),
  packageId: z.uuid({ error: "Invalid package ID format" }),
  customerId: z.uuid({ error: "Invalid customer ID format" }),
  isActive: z.boolean().default(true),
});

export const radiusUsageSchema = z.object({
  username: z.string().min(1, "Username is required"),
  startDate: z.iso.datetime({ error: "Invalid start date format" }),
  endDate: z.iso.datetime({ error: "Invalid end date format" }),
});

// Query parameter schemas
export const listQuerySchema = z.object({
  ...basePaginationSchema,
  ...baseDateRangeSchema,
  sortBy: z.string().max(50).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  status: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
});

export const financeQuerySchema = listQuerySchema.extend({
  jenis: z.enum(["pemasukan", "pengeluaran"]).optional(),
  kategori: z.string().max(100).optional(),
});

// File upload schemas
export const fileUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  mimetype: z.enum([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  size: z.number().max(5 * 1024 * 1024, "File size must be less than 5MB"), // 5MB
});

export const kmzUploadSchema = z.object({
  filename: z.string().min(1, "Filename is required").max(255),
  mimetype: z.enum([
    "application/vnd.google-earth.kmz",
    "application/octet-stream",
  ]),
  size: z.number().max(50 * 1024 * 1024, "File size must be less than 50MB"), // 50MB
});

// Payment schemas
export const paymentCreateSchema = z.object({
  orderId: z.string().min(1, "Order ID is required").max(255),
  amount: z.number().positive("Amount must be positive").max(999999999.99),
  description: z.string().min(1, "Description is required").max(500),
  customerName: z.string().min(1, "Customer name is required").max(100),
  customerEmail: z.email({ error: "Invalid email format" }).max(255).optional(),
  customerPhone: z
    .string()
    .regex(/^[+]?[\d\s\-()]{10,20}$/, "Invalid phone number format")
    .optional(),
  expiryHours: z.number().int().min(1).max(168).default(24), // Max 7 days
});

export const paymentWebhookSchema = z.object({
  orderId: z.string().min(1, "Order ID is required").max(255),
  status: z.enum([
    "SUCCESS",
    "PAID",
    "PENDING",
    "EXPIRED",
    "CANCELLED",
    "FAILED",
  ]),
  amount: z.number().positive("Amount must be positive").max(999999999.99),
  paidTime: z.iso.datetime().optional(),
  paymentMethod: z.string().max(50).optional(),
});

// System configuration schemas
export const systemConfigSchema = z.object({
  key: z.string().min(1, "Configuration key is required").max(100),
  value: z.string().max(1000),
  description: z.string().max(500).optional(),
  category: z.string().max(50).default("general"),
});

// Audit log schemas
export const auditLogQuerySchema = z.object({
  ...basePaginationSchema,
  ...baseDateRangeSchema,
  userId: z.uuid().optional(),
  action: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  ipAddress: z
    .string()
    .regex(
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
      "Invalid IP address format",
    )
    .optional(),
});

// Type exports for use in components
export type FinanceAuthInput = z.infer<typeof financeAuthSchema>;
export type FinancePemasukanInput = z.infer<typeof financePemasukanSchema>;
export type FinancePengeluaranInput = z.infer<typeof financePengeluaranSchema>;
export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
export type TagihanCreateInput = z.infer<typeof tagihanCreateSchema>;
export type TagihanUpdateInput = z.infer<typeof tagihanUpdateSchema>;
export type PackageCreateInput = z.infer<typeof packageCreateSchema>;
export type PackageUpdateInput = z.infer<typeof packageUpdateSchema>;
export type RadiusAccountInput = z.infer<typeof radiusAccountSchema>;
export type RadiusUsageInput = z.infer<typeof radiusUsageSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type FinanceQueryInput = z.infer<typeof financeQuerySchema>;
export type FileUploadInput = z.infer<typeof fileUploadSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type SystemConfigInput = z.infer<typeof systemConfigSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
