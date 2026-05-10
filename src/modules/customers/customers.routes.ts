import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcrypt'
import { CustomerCreateSchema, CustomerUpdateSchema, CustomerQuerySchema } from '../../shared/types.js'
import { badRequest, notFound, conflict } from '../../shared/errors.js'
import { config } from '../../config.js'

// ✅ FIX 1: was bcrypt.hashSync (synchronous — blocks event loop for ~100ms)
//           now async — never freezes the server
async function hashPw(pw: string) { return bcrypt.hash(pw, 10) }

export default async function customersRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // GET /api/v1/customers
  app.get('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const q = CustomerQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { status, search, page, limit } = q.data

    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { name:  { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { id:    { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      app.prisma.customer.findMany({
        where,
        include: { _count: { select: { orders: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.customer.count({ where }),
    ])

    const spentRows = await app.prisma.order.groupBy({
      by:    ['customerId'],
      where: { customerId: { in: items.map(c => c.id) }, status: { not: 'CANCELLED' } },
      _sum:  { total: true },
    })
    const spentMap = new Map(spentRows.map(r => [r.customerId, Number(r._sum.total ?? 0)]))

    const enriched = items.map(c => {
      const { passwordHash: _, ...safe } = c as any
      return { ...safe, totalSpent: spentMap.get(c.id) ?? 0 }
    })

    return reply.send({ items: enriched, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/customers/:id
  app.get('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const [customer, agg] = await Promise.all([
      app.prisma.customer.findUnique({
        where:   { id },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            // ✅ FIX 14 (bundled here): limit orders to avoid huge payloads
            take:    20,
            select:  { id: true, total: true, status: true, createdAt: true },
          },
        },
      }),
      app.prisma.order.aggregate({
        where: { customerId: id, status: { not: 'CANCELLED' } },
        _sum:  { total: true },
      }),
    ])

    if (!customer) return notFound(reply, 'Customer')
    const { passwordHash: _, ...safeCustomer } = customer as any
    return reply.send({ ...safeCustomer, totalSpent: Number(agg._sum.total ?? 0) })
  })

  // POST /api/v1/customers
  app.post('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = CustomerCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    const exists = await app.prisma.customer.findUnique({ where: { email: parsed.data.email } })
    if (exists) return conflict(reply, 'Email already in use')

    const { password, ...rest } = parsed.data
    const customer = await app.prisma.customer.create({
      data: { ...rest, passwordHash: await hashPw(password) }, // ✅ now awaited
    })
    return reply.code(201).send(customer)
  })

  // PATCH /api/v1/customers/:id
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = CustomerUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    if (parsed.data.email) {
      const emailTaken = await app.prisma.customer.findUnique({ where: { email: parsed.data.email } })
      if (emailTaken && emailTaken.id !== id) return conflict(reply, 'Email already in use')
    }

    try {
      const customer = await app.prisma.customer.update({ where: { id }, data: parsed.data })
      return reply.send(customer)
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Customer')
      throw e
    }
  })

  // DELETE /api/v1/customers/:id
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    try {
      await app.prisma.customer.delete({ where: { id } })
      return reply.code(204).send()
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Customer')
      throw e
    }
  })
}