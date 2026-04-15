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
export const ProductOptionSchema = z.object({
  id:       z.string(),
  nameTk:   z.string().min(1),
  nameRu:   z.string().min(1),
  type:     z.enum(['select', 'number', 'text', 'color']),
  unit:     z.string().optional().nullable(),
  values:   z.array(z.string()),
  required: z.boolean().default(false),
})

export const ProductCreateSchema = z.object({
  nameTk:     z.string().min(1),
  nameRu:     z.string().min(1),
  descriptionTk: z.string().nullable().optional(),
  descriptionRu: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  image:      z.string().default('📦'),
  imageUrl:   z.string().url().nullable().optional(),
  imageUrls:  z.array(z.string().url()).default([]),  // ← NEW
  price:      z.coerce.number().positive(),
  weightG:    z.coerce.number().int().positive().nullable().optional(),
  stock:      z.coerce.number().int().min(0).default(0),
  status:     z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).default('ACTIVE'),
  markup:     z.coerce.number().int().min(0).default(50),
  options:    z.array(z.any()).default([]),
})

export const ProductUpdateSchema = ProductCreateSchema.partial()
export const ProductQuerySchema = z.object({
  status:   z.enum(['ACTIVE', 'DRAFT', 'ARCHIVED']).optional(),
  search:   z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'popular', 'random']).optional().default('random'),
  exclude:  z.string().optional(),
  page:     z.coerce.number().int().positive().default(1),
  limit:    z.coerce.number().int().positive().max(100).default(20),
})

// ─── Orders ───────────────────────────────────────────────────────────────────
// Find the line item schema inside OrderCreateSchema — add options:
const OrderLineSchema = z.object({
  productId: z.string(),
  qty:       z.number().int().positive(),
  unitPrice: z.number().positive(),
  options:   z.record(z.string(), z.string()).optional().default({}), // ← ADD THIS
})
export const OrderCreateSchema = z.object({
  customerId:   z.string().min(1),
  deliveryType: z.enum(['simple', 'fast']).default('simple'),
  homeDelivery: z.boolean().default(false),
  lines:        z.array(OrderLineSchema).min(1),
  note:         z.string().optional(),
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