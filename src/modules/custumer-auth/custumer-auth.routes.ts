import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { config } from '../../config.js'
import { CustomerRegisterSchema, CustomerLoginSchema } from '../../shared/types.js'
import { badRequest, unauthorized, notFound, conflict } from '../../shared/errors.js'

function hashPw(pw: string)                 { return bcrypt.hashSync(pw, 10) }
function verifyPw(pw: string, hash: string) { return bcrypt.compareSync(pw, hash) }

const CustomerOrderLineSchema = z.object({
  productId: z.string().min(1),
  qty:       z.number().int().positive(),
  unitPrice: z.number().positive(),
  options:   z.record(z.string(), z.string()).optional().default({}),
})

const CustomerOrderCreateSchema = z.object({
  deliveryType: z.enum(['simple', 'fast']).default('simple'),
  homeDelivery: z.boolean().default(false),
  lines: z.array(CustomerOrderLineSchema).min(1, 'Order must have at least one item'),
  note:  z.string().optional(),
})

export default async function customerAuthRoutes(app: FastifyInstance) {

  // ── POST /api/v1/customer/register ─────────────────────────────────────────
  app.post('/register', {
    rateLimit: { max: config.rateLimits.customerAuth.max, timeWindow: config.rateLimits.customerAuth.timeWindow }
  }, async (req, reply) => {
    const parsed = CustomerRegisterSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { name, email, phone, address, password } = parsed.data

    const exists = await app.prisma.customer.findUnique({ where: { email } })
    if (exists) return conflict(reply, 'Email already registered')

    const customer = await (app.prisma.customer as any).create({
      data: { name, email, phone, address, passwordHash: hashPw(password) },
    })

    const payload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const accessToken  = app.jwt.sign({ ...payload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn })

    return reply.code(201).send({
      accessToken, refreshToken,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    })
  })

  // ── POST /api/v1/customer/login ────────────────────────────────────────────
  app.post('/login', {
    rateLimit: { max: config.rateLimits.customerAuth.max, timeWindow: config.rateLimits.customerAuth.timeWindow }
  }, async (req, reply) => {
    const parsed = CustomerLoginSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { email, password } = parsed.data

    const customer = await (app.prisma.customer as any).findUnique({ where: { email } })
    if (!customer || !customer.passwordHash || !verifyPw(password, customer.passwordHash)) {
      return unauthorized(reply, 'Invalid email or password')
    }
    if (customer.status === 'BLOCKED') return unauthorized(reply, 'Account is blocked')

    const payload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const accessToken  = app.jwt.sign({ ...payload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const refreshToken = app.jwt.sign({ ...payload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn })

    return reply.code(200).send({
      accessToken, refreshToken,
      customer: { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone },
    })
  })

  // ── POST /api/v1/customer/refresh ──────────────────────────────────────────
  app.post('/refresh', {
    rateLimit: { max: config.rateLimits.refresh.max, timeWindow: config.rateLimits.refresh.timeWindow }
  }, async (req, reply) => {
    const { refreshToken } = req.body as { refreshToken?: string }
    if (!refreshToken) return badRequest(reply, 'Refresh token required')

    let payload: any
    try {
      payload = app.jwt.verify(refreshToken)
    } catch {
      return unauthorized(reply, 'Invalid or expired refresh token')
    }

    if (payload.role !== 'CUSTOMER' || payload.type !== 'refresh') {
      return unauthorized(reply, 'Invalid token type')
    }

    const customer = await app.prisma.customer.findUnique({ where: { id: payload.sub } })
    if (!customer)                     return unauthorized(reply, 'Customer not found')
    if (customer.status === 'BLOCKED') return unauthorized(reply, 'Account is blocked')

    const newPayload      = { sub: customer.id, email: customer.email, role: 'CUSTOMER' }
    const newAccessToken  = app.jwt.sign({ ...newPayload, type: 'access'  }, { expiresIn: config.jwt.accessExpiresIn  })
    const newRefreshToken = app.jwt.sign({ ...newPayload, type: 'refresh' }, { expiresIn: config.jwt.refreshExpiresIn })

    return reply.send({ accessToken: newAccessToken, refreshToken: newRefreshToken })
  })

  // ── GET /api/v1/customer/me ────────────────────────────────────────────────
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

  // ── GET /api/v1/customer/orders ────────────────────────────────────────────
  app.get('/orders', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const orders = await app.prisma.order.findMany({
      where:   { customerId: user.sub },
      include: { lines: { include: { product: { include: { category: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send(orders)
  })

  // ── POST /api/v1/customer/orders ───────────────────────────────────────────
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
      select: { id: true, weightG: true, stock: true },
    })

    if (products.length !== productIds.length) {
      const foundIds   = products.map(p => p.id)
      const missingIds = productIds.filter(id => !foundIds.includes(id))
      return badRequest(reply, `Products not found: ${missingIds.join(', ')}`)
    }

    const weightMap     = new Map(products.map(p => [p.id, p.weightG ?? 0]))
    const subtotal      = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const totalWeightKg = lines.reduce((s, l) => s + (weightMap.get(l.productId) ?? 0) * l.qty, 0) / 1000
    const rate          = deliveryType === 'fast' ? 11 : 7
    const total         = subtotal + totalWeightKg * rate + (homeDelivery ? 1 : 0)

    let order
    try {
      order = await app.prisma.$transaction(async (tx) => {
        // 1. Check stock
        for (const line of lines) {
          const product = products.find(p => p.id === line.productId)!
          if (product.stock < line.qty) {
            throw new Error(`Insufficient stock for product ${line.productId}`)
          }
        }

        // 2. Create order
        const created = await tx.order.create({
          data:    { customerId: user.sub, total, note, deliveryType, homeDelivery, lines: { create: lines } },
          include: { customer: true, lines: { include: { product: { include: { category: true } } } } },
        })

        // 3. Deduct stock + increment sold
        await Promise.all(lines.map(line =>
          tx.product.update({
            where: { id: line.productId },
            data:  { stock: { decrement: line.qty }, sold: { increment: line.qty } },
          })
        ))

        return created
      })
    } catch (e: any) {
      if (e.message?.includes('Insufficient stock')) {
        return badRequest(reply, e.message)
      }
      throw e
    }

    return reply.code(201).send(order)
  })

  // ── PATCH /api/v1/customer/me ──────────────────────────────────────────────
  app.patch('/me', {
    onRequest: [app.authenticate],
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const body = req.body as any

    // Password change
    if (body.currentPassword || body.newPassword) {
      const customer = await app.prisma.customer.findUnique({ where: { id: user.sub } })
      if (!customer) return notFound(reply, 'Customer')
      if (!customer.passwordHash || !verifyPw(body.currentPassword, customer.passwordHash)) {
        return unauthorized(reply, 'Current password is incorrect')
      }
      await app.prisma.customer.update({
        where: { id: user.sub },
        data:  { passwordHash: hashPw(body.newPassword) },
      })
      return reply.send({ ok: true })
    }

    // Profile update
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