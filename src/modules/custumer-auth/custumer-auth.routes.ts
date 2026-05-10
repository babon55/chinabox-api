import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { config } from '../../config.js'
import { CustomerRegisterSchema, CustomerLoginSchema } from '../../shared/types.js'
import { badRequest, unauthorized, notFound, conflict } from '../../shared/errors.js'

async function hashPw(pw: string)                 { return bcrypt.hash(pw, 10) }
async function verifyPw(pw: string, hash: string) { return bcrypt.compare(pw, hash) }

// ✅ FIX 9 (bundled): parse '7d' / '15m' from config instead of hardcoding ms
function parseTtlMs(ttl: string): number {
  const match = ttl.match(/^(\d+)([smhd])$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const v = parseInt(match[1], 10)
  switch (match[2]) {
    case 's': return v * 1000
    case 'm': return v * 60 * 1000
    case 'h': return v * 60 * 60 * 1000
    case 'd': return v * 24 * 60 * 60 * 1000
    default:  return 7 * 24 * 60 * 60 * 1000
  }
}

const CustomerOrderLineSchema = z.object({
  productId: z.string().min(1),
  qty:       z.number().int().positive(),
  unitPrice: z.number().positive(),
  options:   z.record(z.string(), z.string()).optional().default({}),
})

const CustomerOrderCreateSchema = z.object({
  deliveryType: z.enum(['simple', 'fast']).default('simple'),
  homeDelivery: z.boolean().default(false),
  lines:        z.array(CustomerOrderLineSchema).min(1, 'Order must have at least one item'),
  note:         z.string().optional(),
})

// ✅ FIX 2: pagination schema for GET /orders
const OrderQuerySchema = z.object({
  page:  z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

export default async function customerAuthRoutes(app: FastifyInstance) {

  // ── POST /api/v1/customer/register ────────────────────────────────────────
  app.post('/register', {
    rateLimit: { max: config.rateLimits.customerAuth.max, timeWindow: config.rateLimits.customerAuth.timeWindow }
  }, async (req, reply) => {
    const parsed = CustomerRegisterSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { name, email, phone, address, password } = parsed.data

    const exists = await app.prisma.customer.findUnique({ where: { email } })
    if (exists) return conflict(reply, 'Email already registered')

    const customer = await app.prisma.customer.create({
      data: { name, email, phone, address, passwordHash: await hashPw(password) },
    })

    const payload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const accessToken  = app.jwt.sign({ ...payload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn, secret: config.jwt.refreshSecret })

    // ✅ FIX 3: store refresh token in DB so it can be revoked
    const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshExpiresIn))
    await app.prisma.refreshToken.create({
      data: { token: refreshToken, userId: customer.id, expiresAt },
    })

    return reply.code(201).send({
      accessToken, refreshToken,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    })
  })

  // ── POST /api/v1/customer/login ───────────────────────────────────────────
  app.post('/login', {
    rateLimit: { max: config.rateLimits.customerAuth.max, timeWindow: config.rateLimits.customerAuth.timeWindow }
  }, async (req, reply) => {
    const parsed = CustomerLoginSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { email, password } = parsed.data

    const customer = await app.prisma.customer.findUnique({ where: { email } })
    if (!customer || !customer.passwordHash || !await verifyPw(password, customer.passwordHash)) {
      return unauthorized(reply, 'Invalid email or password')
    }
    if (customer.status === 'BLOCKED') return unauthorized(reply, 'Account is blocked')

    const payload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const accessToken  = app.jwt.sign({ ...payload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn, secret: config.jwt.refreshSecret })

    // ✅ FIX 3: store refresh token in DB
    const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshExpiresIn))
    await app.prisma.refreshToken.create({
      data: { token: refreshToken, userId: customer.id, expiresAt },
    })

    return reply.code(200).send({
      accessToken, refreshToken,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    })
  })

  // ── POST /api/v1/customer/refresh ─────────────────────────────────────────
  app.post('/refresh', {
    rateLimit: { max: config.rateLimits.refresh.max, timeWindow: config.rateLimits.refresh.timeWindow }
  }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) return badRequest(reply, 'Refresh token required')

    // 1. Verify JWT signature first (fast, no DB)
    let payload: any
    try {
      payload = app.jwt.verify(refreshToken, { secret: config.jwt.refreshSecret } as any)
    } catch {
      return unauthorized(reply, 'Invalid or expired refresh token')
    }

    if (payload.role !== 'CUSTOMER' || payload.type !== 'refresh') {
      return unauthorized(reply, 'Invalid token type')
    }

    // ✅ FIX 3: validate token exists in DB and hasn't expired
    const stored = await app.prisma.refreshToken.findUnique({ where: { token: refreshToken } })
    if (!stored || stored.expiresAt < new Date()) {
      return unauthorized(reply, 'Refresh token expired or revoked')
    }

    const customer = await app.prisma.customer.findUnique({ where: { id: payload.sub } })
    if (!customer)                     return unauthorized(reply, 'Customer not found')
    if (customer.status === 'BLOCKED') return unauthorized(reply, 'Account is blocked')

    // Rotate: delete old token, issue new pair
    await app.prisma.refreshToken.delete({ where: { token: refreshToken } })

    const newPayload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const newAccessToken  = app.jwt.sign({ ...newPayload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const newRefreshToken = app.jwt.sign({ ...newPayload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn, secret: config.jwt.refreshSecret })

    const expiresAt = new Date(Date.now() + parseTtlMs(config.jwt.refreshExpiresIn))
    await app.prisma.refreshToken.create({
      data: { token: newRefreshToken, userId: customer.id, expiresAt },
    })

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // ── POST /api/v1/customer/logout ──────────────────────────────────────────
  app.post('/logout', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string }
    // ✅ FIX 3: delete token from DB on logout so it can't be reused
    if (refreshToken) {
      await app.prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    }
    return reply.code(204).send()
  })

  // ── GET /api/v1/customer/me ───────────────────────────────────────────────
  app.get('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const customer = await app.prisma.customer.findUnique({
      where:  { id: user.sub },
      select: { id: true, name: true, email: true, phone: true, address: true, status: true, createdAt: true },
    })
    if (!customer) return notFound(reply, 'Customer')
    return reply.send(customer)
  })

  // ── GET /api/v1/customer/orders ───────────────────────────────────────────
  app.get('/orders', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    // ✅ FIX 2: paginated, select only needed fields (was: all orders, all joins, no limit)
    const q = OrderQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { page, limit } = q.data

    const [orders, total] = await Promise.all([
      app.prisma.order.findMany({
        where:   { customerId: user.sub },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        select: {
          id:           true,
          status:       true,
          total:        true,
          deliveryType: true,
          homeDelivery: true,
          note:         true,
          createdAt:    true,
          updatedAt:    true,
          lines: {
            select: {
              id:        true,
              qty:       true,
              unitPrice: true,
              options:   true,
              product: {
                select: {
                  id:      true,
                  nameTk:  true,
                  nameRu:  true,
                  image:   true,
                  imageUrl:true,
                }
              }
            }
          }
        },
      }),
      app.prisma.order.count({ where: { customerId: user.sub } }),
    ])

    const items = orders.map(o => ({
      ...o,
      total: Number(o.total),
      lines: o.lines.map(l => ({ ...l, unitPrice: Number(l.unitPrice) })),
    }))

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // ── POST /api/v1/customer/orders ──────────────────────────────────────────
  app.post('/orders', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const parsed = CustomerOrderCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { lines, note, deliveryType, homeDelivery } = parsed.data

    const productIds = lines.map(l => l.productId)
    const products   = await app.prisma.product.findMany({
      where:  { id: { in: productIds } },
      select: { id: true, weightG: true, stock: true, price: true },
    })

    if (products.length !== productIds.length) {
      const foundIds   = new Set(products.map(p => p.id))
      const missingIds = productIds.filter(id => !foundIds.has(id))
      return badRequest(reply, `Products not found: ${missingIds.join(', ')}`)
    }

    const weightMap     = new Map(products.map(p => [p.id, p.weightG ?? 0]))
    const subtotal      = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const totalWeightKg = lines.reduce((s, l) => s + (weightMap.get(l.productId) ?? 0) * l.qty, 0) / 1000
    const rate          = deliveryType === 'fast' ? 140 : 60
    const total         = subtotal + totalWeightKg * rate + (homeDelivery ? 20 : 0)

    let order
    try {
      order = await app.prisma.$transaction(async (tx) => {
        // ✅ FIX 4: atomic stock check + decrement in one SQL statement per line
        // updateMany only succeeds if stock >= qty at the moment of the update
        // This eliminates the race condition where two requests pass the check simultaneously
        for (const line of lines) {
          const result = await tx.product.updateMany({
            where: { id: line.productId, stock: { gte: line.qty } },
            data:  { stock: { decrement: line.qty }, sold: { increment: line.qty } },
          })
          if (result.count === 0) {
            throw new Error(`Insufficient stock for product ${line.productId}`)
          }
        }

        // Create order after stock is confirmed and deducted
        return tx.order.create({
          data:    { customerId: user.sub, total, note, deliveryType, homeDelivery, lines: { create: lines } },
          include: {
            lines: {
              include: {
                product: { select: { id: true, nameTk: true, nameRu: true, image: true, imageUrl: true } }
              }
            }
          },
        })
      })
    } catch (e: any) {
      if (e.message?.includes('Insufficient stock')) {
        return badRequest(reply, e.message)
      }
      throw e
    }

    return reply.code(201).send({
      ...order,
      total: Number(order.total),
      lines: order.lines.map((l: any) => ({ ...l, unitPrice: Number(l.unitPrice) })),
    })
  })

  // ── PATCH /api/v1/customer/me ─────────────────────────────────────────────
  app.patch('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const body = req.body as any

    // Password change path
    if (body.currentPassword || body.newPassword) {
      const customer = await app.prisma.customer.findUnique({ where: { id: user.sub } })
      if (!customer) return notFound(reply, 'Customer')
      if (!customer.passwordHash || !await verifyPw(body.currentPassword, customer.passwordHash)) {
        return unauthorized(reply, 'Current password is incorrect')
      }
      await app.prisma.customer.update({
        where: { id: user.sub },
        data:  { passwordHash: await hashPw(body.newPassword) },
      })
      return reply.send({ ok: true })
    }

    // Profile update path
    const { name, phone, address, email } = body
    if (email) {
      const exists = await app.prisma.customer.findUnique({ where: { email } })
      if (exists && exists.id !== user.sub) return conflict(reply, 'Email already in use')
    }
    const updated = await app.prisma.customer.update({
      where:  { id: user.sub },
      data:   { name, phone, address, email },
      select: { id: true, name: true, email: true, phone: true, address: true },
    })
    return reply.send(updated)
  })
}