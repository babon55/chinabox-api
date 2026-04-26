import type { FastifyInstance } from 'fastify'
import { OrderCreateSchema, OrderUpdateSchema, OrderQuerySchema } from '../../shared/types.js'
import { badRequest, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'

const orderInclude = {
  customer: true,
  lines: {
    include: {
      product: {
        select: {
          id: true,
          nameTk: true,
          nameRu: true,
          image: true,
          imageUrl: true,
          price: true,
          options: true,
          category: { select: { id: true, nameTk: true, nameRu: true } }
        }
      }
    }
  },
}

const trackInclude = {
  lines: {
    include: {
      product: {
        select: { nameTk: true, nameRu: true, image: true, options: true }
      }
    }
  },
}

function serializeOrder(order: any): any {
  return {
    ...order,
    total: Number(order.total),
    lines: order.lines.map((line: any) => ({
      ...line,
      unitPrice: Number(line.unitPrice)
    }))
  }
}

export default async function ordersRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // PUBLIC: GET /api/v1/orders/track/:id
  app.get('/track/:id', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const order = await app.prisma.order.findUnique({ where: { id }, include: trackInclude })
    if (!order) return notFound(reply, 'Order')
    return reply.send({
      id:        order.id,
      status:    order.status,
      total:     Number(order.total),
      note:      order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lines: order.lines.map((l: any) => ({
        qty:       l.qty,
        unitPrice: Number(l.unitPrice),
        options:   l.options,
        product:   l.product,
      })),
    })
  })

  // GET /api/v1/orders
  app.get('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
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

    const [itemsRaw, total] = await Promise.all([
      app.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.order.count({ where }),
    ])

    return reply.send({ items: itemsRaw.map(serializeOrder), total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/orders/:id
  app.get('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const order = await app.prisma.order.findUnique({ where: { id }, include: orderInclude })
    if (!order) return notFound(reply, 'Order')
    return reply.send(serializeOrder(order))
  })

  // POST /api/v1/orders
  app.post('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = OrderCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { customerId, lines, note, deliveryType, homeDelivery } = parsed.data

    // FIX: single parallel query for customer + all products (was 2N+1 queries)
    const productIds = [...new Set(lines.map(l => l.productId))]
    const [customer, products] = await Promise.all([
      app.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } }),
      app.prisma.product.findMany({
        where:  { id: { in: productIds } },
        select: { id: true, weightG: true, options: true },
      }),
    ])

    if (!customer) return notFound(reply, 'Customer')

    if (products.length !== productIds.length) {
      const foundIds   = new Set(products.map(p => p.id))
      const missingIds = productIds.filter(id => !foundIds.has(id))
      return badRequest(reply, `Products not found: ${missingIds.join(', ')}`)
    }

    const productMap = new Map(products.map(p => [p.id, p]))

    for (const line of lines) {
      const product = productMap.get(line.productId)!
      const optionsArray = Array.isArray(product.options)
        ? product.options as any[]
        : typeof product.options === 'string'
          ? JSON.parse(product.options || '[]')
          : []

      for (const opt of optionsArray.filter((o: any) => o.required !== false)) {
        if (!line.options?.[opt.id]) {
          return badRequest(reply, `Missing required option '${opt.id}' for product ${line.productId}`)
        }
      }
    }

    const subtotal      = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)
    const totalWeightKg = lines.reduce((s, l) => s + (productMap.get(l.productId)?.weightG ?? 0) * l.qty, 0) / 1000
    const rate          = deliveryType === 'fast' ? 11 : 7
    const total         = subtotal + totalWeightKg * rate + (homeDelivery ? 1 : 0)

    const order = await app.prisma.order.create({
      data:    { customerId, total, note, deliveryType, homeDelivery, lines: { create: lines } },
      include: orderInclude,
    })

    return reply.code(201).send(serializeOrder(order))
  })

  // PATCH /api/v1/orders/:id
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = OrderUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    // FIX: update directly, catch P2025 — removes 1 unnecessary DB round-trip
    try {
      const order = await app.prisma.order.update({ where: { id }, data: parsed.data, include: orderInclude })
      return reply.send(serializeOrder(order))
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Order')
      throw e
    }
  })

  // DELETE /api/v1/orders/:id
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    // FIX: delete directly, catch P2025 — removes 1 unnecessary DB round-trip
    try {
      await app.prisma.order.delete({ where: { id } })
      return reply.code(204).send()
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Order')
      throw e
    }
  })
}