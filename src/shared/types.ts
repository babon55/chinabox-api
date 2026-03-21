import { z } from 'zod'

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(6),
})
export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
})

// ─── Products ─────────────────────────────────────────────────────────────────
export const ProductCreateSchema = z.object({
  nameTk:     z.string().min(1),
  nameRu:     z.string().min(1),
  categoryId: z.string().min(1),
  image:      z.string().default('📦'),
  imageUrl:   z.string().url().optional().nullable(),
  price:      z.number().positive(),
  weightG:    z.number().int().min(0).optional().nullable(),
  stock:      z.number().int().min(0),
  status:     z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
})
export const ProductUpdateSchema = ProductCreateSchema.partial()
export const ProductQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

// ─── Orders ───────────────────────────────────────────────────────────────────
export const OrderLineSchema = z.object({
  productId: z.string().min(1),
  qty:       z.number().int().positive(),
  unitPrice: z.number().positive(),
})
export const OrderCreateSchema = z.object({
  customerId: z.string().min(1),
  lines:      z.array(OrderLineSchema).min(1),
  note:       z.string().optional(),
})
export const OrderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  note:   z.string().optional(),
})
export const OrderQuerySchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

// ─── Customers ────────────────────────────────────────────────────────────────
export const CustomerCreateSchema = z.object({
  name:    z.string().min(1),
  email:   z.string().email(),
  phone:   z.string().min(1),
  address: z.string().min(1),
})
export const CustomerUpdateSchema = z.object({
  name:    z.string().min(1).optional(),
  email:   z.string().email().optional(),
  phone:   z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  status:  z.enum(['ACTIVE', 'BLOCKED']).optional(),
})
export const CustomerQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'BLOCKED']).optional(),
  search: z.string().optional(),
  page:   z.coerce.number().int().positive().default(1),
  limit:  z.coerce.number().int().positive().max(100).default(20),
})

// ─── Analytics ────────────────────────────────────────────────────────────────
export const AnalyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '12m']).default('30d'),
})

// ─── Settings ─────────────────────────────────────────────────────────────────
export const StoreSettingsSchema = z.object({
  nameTk:    z.string().min(1).optional(),
  nameRu:    z.string().min(1).optional(),
  taglineTk: z.string().optional(),
  taglineRu: z.string().optional(),
  email:     z.string().email().optional(),
  phone:     z.string().optional(),
  addressTk: z.string().optional(),
  addressRu: z.string().optional(),
  currency:  z.enum(['USD', 'EUR', 'TMT', 'RUB']).optional(),
  logo:      z.string().optional(),
})
export const AccountUpdateSchema = z.object({
  name:     z.string().min(1).optional(),
  phone:    z.string().optional(),
  avatar:   z.string().optional(),
  timezone: z.string().optional(),
  langPref: z.enum(['tk', 'ru']).optional(),
})
export const PasswordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     z.string().min(8),
})

// ─── Customer Auth ────────────────────────────────────────────────────────────
export const CustomerRegisterSchema = z.object({
  name:     z.string().min(1),
  email:    z.string().email(),
  phone:    z.string().min(1),
  address:  z.string().default(''),
  password: z.string().min(8),
})

export const CustomerLoginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
})