import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { z } from 'zod'
import { config } from '../../config.js'
import { CustomerRegisterSchema, CustomerLoginSchema } from '../../shared/types.js'
import { badRequest, unauthorized, notFound, conflict } from '../../shared/errors.js'

function hashPw(pw: string) {
  return createHash('sha256').update(pw).digest('hex')
}

const CustomerOrderLineSchema = z.object({
  productId: z.string().min(1),
  qty:       z.number().int().positive(),
  unitPrice: z.number().positive(),
  options:   z.record(z.string(), z.string()).optional().default({}), // ← ADD THIS
})

const CustomerOrderCreateSchema = z.object({
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
    if (!customer || !customer.passwordHash || customer.passwordHash !== hashPw(password)) {
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
    const { lines, note } = parsed.data

    const productIds = lines.map(l => l.productId)
    const products   = await app.prisma.product.findMany({
      where: { id: { in: productIds } }, select: { id: true },
    })

    if (products.length !== productIds.length) {
      const foundIds   = products.map(p => p.id)
      const missingIds = productIds.filter(id => !foundIds.includes(id))
      return badRequest(reply, `Products not found: ${missingIds.join(', ')}`)
    }

    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const order = await app.prisma.order.create({
      data: { customerId: user.sub, total, note, lines: { create: lines } },
      include: { customer: true, lines: { include: { product: { include: { category: true } } } } },
    })

    return reply.code(201).send(order)
  })
}