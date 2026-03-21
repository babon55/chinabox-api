import type { FastifyInstance } from 'fastify'
import { OrderCreateSchema, OrderUpdateSchema, OrderQuerySchema } from '../../shared/types.js'
import { badRequest, notFound } from '../../shared/errors.js'

const orderInclude = {
  customer: true,
  lines: { include: { product: { include: { category: true } } } },
}

// Safe fields for public tracking — no personal customer info
const trackInclude = {
  lines: { include: { product: { select: { nameTk: true, nameRu: true, image: true } } } },
}

export default async function ordersRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── PUBLIC: GET /api/v1/orders/track/:id ─────────────────────
  // No auth required — returns safe order info only
  app.get('/track/:id', async (req, reply) => {
    const { id } = req.params as { id: string }

    const order = await app.prisma.order.findUnique({
      where:   { id },
      include: trackInclude,
    })

    if (!order) return notFound(reply, 'Order')

    // Return only safe public fields — no customer personal data
    return reply.send({
      id:        order.id,
      status:    order.status,
      total:     order.total,
      note:      order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lines:     order.lines.map(l => ({
        qty:       l.qty,
        unitPrice: l.unitPrice,
        product:   l.product,
      })),
    })
  })

  // GET /api/v1/orders
  app.get('/', guard, async (req, reply) => {
    const q = OrderQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { status, search, page, limit } = q.data

    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { id:       { contains: search, mode: 'insensitive' as const } },
          { customer: { name:  { contains: search, mode: 'insensitive' as const } } },
          { customer: { email: { contains: search, mode: 'insensitive' as const } } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      app.prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      app.prisma.order.count({ where }),
    ])
    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/orders/:id
  app.get('/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    const order  = await app.prisma.order.findUnique({ where: { id }, include: orderInclude })
    if (!order) return notFound(reply, 'Order')
    return reply.send(order)
  })

  // POST /api/v1/orders
  app.post('/', guard, async (req, reply) => {
    const parsed = OrderCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { customerId, lines, note } = parsed.data

    const customer = await app.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) return notFound(reply, 'Customer')

    const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const order = await app.prisma.order.create({
      data: { customerId, total, note, lines: { create: lines } },
      include: orderInclude,
    })
    return reply.code(201).send(order)
  })

  // PATCH /api/v1/orders/:id
  app.patch('/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = OrderUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const exists = await app.prisma.order.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Order')
    const order = await app.prisma.order.update({ where: { id }, data: parsed.data, include: orderInclude })
    return reply.send(order)
  })

  // DELETE /api/v1/orders/:id
  app.delete('/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await app.prisma.order.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Order')
    await app.prisma.order.delete({ where: { id } })
    return reply.code(204).send()
  })
}