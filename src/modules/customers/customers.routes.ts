import type { FastifyInstance } from 'fastify'
import { createHash } from 'crypto'
import { CustomerCreateSchema, CustomerUpdateSchema, CustomerQuerySchema } from '../../shared/types.js'
import { badRequest, notFound, conflict } from '../../shared/errors.js'
import { config } from '../../config.js'

function hashPw(pw: string) {
  return createHash('sha256').update(pw).digest('hex')
}

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

    const enriched = await Promise.all(items.map(async c => {
      const agg = await app.prisma.order.aggregate({
        where: { customerId: c.id, status: { not: 'CANCELLED' } },
        _sum:  { total: true },
      })
      return { ...c, totalSpent: Number(agg._sum.total ?? 0) }
    }))

    return reply.send({ items: enriched, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/customers/:id
  app.get('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id }   = req.params as { id: string }
    const customer = await app.prisma.customer.findUnique({
      where:   { id },
      include: { orders: { orderBy: { createdAt: 'desc' }, select: { id: true, total: true, status: true, createdAt: true } } },
    })
    if (!customer) return notFound(reply, 'Customer')
    const agg = await app.prisma.order.aggregate({
      where: { customerId: id, status: { not: 'CANCELLED' } },
      _sum:  { total: true },
    })
    return reply.send({ ...customer, totalSpent: Number(agg._sum.total ?? 0) })
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
      data: { ...rest, passwordHash: hashPw(password) },
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
    const exists = await app.prisma.customer.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Customer')
    if (parsed.data.email && parsed.data.email !== exists.email) {
      const emailTaken = await app.prisma.customer.findUnique({ where: { email: parsed.data.email } })
      if (emailTaken) return conflict(reply, 'Email already in use')
    }
    const customer = await app.prisma.customer.update({ where: { id }, data: parsed.data })
    return reply.send(customer)
  })

  // DELETE /api/v1/customers/:id
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await app.prisma.customer.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Customer')
    await app.prisma.customer.delete({ where: { id } })
    return reply.code(204).send()
  })
}