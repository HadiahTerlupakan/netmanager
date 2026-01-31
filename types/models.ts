/**
 * Re-export Prisma types dan custom model extensions
 */

import type { Prisma, PrismaClient as PrismaClientType } from '@prisma/client';

// Export Prisma namespace
export type { Prisma };

// Commonly used Prisma types dengan convenience aliases
export type PrismaClient = PrismaClientType;
export type PrismaTransaction = Omit<PrismaClientType, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

// Prisma where input types untuk reusable filters
export type UserWhereInput = Prisma.UserWhereInput;
export type PelangganWhereInput = Prisma.PelangganWhereInput;
export type InvoiceWhereInput = Prisma.InvoiceWhereInput;
export type WorkOrderWhereInput = Prisma.WorkOrdersWhereInput;
export type BarangWhereInput = Prisma.BarangWhereInput;
export type GudangWhereInput = Prisma.GudangWhereInput;

// Prisma order by types
export type UserOrderByInput = Prisma.UserOrderByWithRelationInput;
export type PelangganOrderByInput = Prisma.PelangganOrderByWithRelationInput;
export type InvoiceOrderByInput = Prisma.InvoiceOrderByWithRelationInput;
export type BarangOrderByInput = Prisma.BarangOrderByWithRelationInput;
export type GudangOrderByInput = Prisma.GudangOrderByWithRelationInput;

// Prisma create input types
export type UserCreateInput = Prisma.UserCreateInput;
export type PelangganCreateInput = Prisma.PelangganCreateInput;
export type InvoiceCreateInput = Prisma.InvoiceCreateInput;
export type BarangCreateInput = Prisma.BarangCreateInput;
export type GudangCreateInput = Prisma.GudangCreateInput;
export type PaymentCreateInput = Prisma.PaymentCreateInput;
export type ExpenseCreateInput = Prisma.ExpenseCreateInput;

// Prisma update input types
export type UserUpdateInput = Prisma.UserUpdateInput;
export type PelangganUpdateInput = Prisma.PelangganUpdateInput;
export type InvoiceUpdateInput = Prisma.InvoiceUpdateInput;
export type BarangUpdateInput = Prisma.BarangUpdateInput;
export type GudangUpdateInput = Prisma.GudangUpdateInput;
export type PaymentUpdateInput = Prisma.PaymentUpdateInput;
export type ExpenseUpdateInput = Prisma.ExpenseUpdateInput;

// Prisma select types
export type UserSelect = Prisma.UserSelect;
export type PelangganSelect = Prisma.PelangganSelect;
export type InvoiceSelect = Prisma.InvoiceSelect;
export type BarangSelect = Prisma.BarangSelect;
export type GudangSelect = Prisma.GudangSelect;

// Prisma include types
export type UserInclude = Prisma.UserInclude;
export type PelangganInclude = Prisma.PelangganInclude;
export type InvoiceInclude = Prisma.InvoiceInclude;
export type BarangGudangInclude = Prisma.BarangGudangInclude;
export type WorkOrdersInclude = Prisma.WorkOrdersInclude;
