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

// Safe fields for public tracking — no personal customer info
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

  // ── PUBLIC: GET /api/v1/orders/track/:id ─────────────────────
  app.get('/track/:id', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const order = await app.prisma.order.findUnique({
      where: { id },
      include: trackInclude,
    })

    if (!order) return notFound(reply, 'Order')

    const serialized = {
      id:        order.id,
      status:    order.status,
      total:     Number(order.total),
      note:      order.note,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      lines: order.lines.map(l => ({
        qty:       l.qty,
        unitPrice: Number(l.unitPrice),
        options:   l.options,
        product:   l.product,
      })),
    }
    return reply.send(serialized)
  })

  // ── GET /api/v1/orders ───────────────────────────────────────
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
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.order.count({ where }),
    ])
    const items = itemsRaw.map(serializeOrder)

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // ── GET /api/v1/orders/:id ───────────────────────────────────
  app.get('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const order = await app.prisma.order.findUnique({ where: { id }, include: orderInclude })
    if (!order) return notFound(reply, 'Order')
    return reply.send(serializeOrder(order))
  })

  // ── POST /api/v1/orders ──────────────────────────────────────
  app.post('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = OrderCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const { customerId, lines, note, deliveryType, homeDelivery } = parsed.data

    // Verify customer exists
    const customer = await app.prisma.customer.findUnique({ where: { id: customerId } })
    if (!customer) return notFound(reply, 'Customer')

    // Validate required options for each line
    for (const line of lines) {
      const product = await app.prisma.product.findUnique({
        where: { id: line.productId },
        select: { options: true, weightG: true }
      })
      if (!product) return badRequest(reply, `Invalid product ID: ${line.productId}`)

      // Ensure options is an array before filtering
      const optionsArray = Array.isArray(product.options)
        ? product.options as any[]
        : typeof product.options === 'string'
          ? JSON.parse(product.options || '[]')
          : []

      const requiredOptions = optionsArray.filter((o: any) => o.required !== false)

      for (const opt of requiredOptions) {
        if (!line.options || !line.options[opt.id]) {
          return badRequest(reply, `Missing required option '${opt.id}' for product ${line.productId}`)
        }
      }
    }

    // Calculate subtotal (products only)
    const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0)

    // Calculate total weight (grams) and delivery
    const productIds = [...new Set(lines.map(l => l.productId))]
    const products = await app.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, weightG: true }
    })
    const weightMap = new Map(products.map(p => [p.id, p.weightG ?? 0]))

    let totalWeightGrams = 0
    for (const line of lines) {
      const weight = weightMap.get(line.productId) ?? 0
      totalWeightGrams += weight * line.qty
    }
    const weightKg = totalWeightGrams / 1000
const rate     = deliveryType === 'fast' ? 11 : 7
const delivery = weightKg * rate + (homeDelivery ? 1 : 0)
const total    = subtotal + delivery

    // Create order with lines
    const order = await app.prisma.order.create({
      data: { customerId, total, note, deliveryType, homeDelivery, lines: { create: lines } },
      include: orderInclude,
    })

    return reply.code(201).send(serializeOrder(order))
  })

  // ── PATCH /api/v1/orders/:id ─────────────────────────────────
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = OrderUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const exists = await app.prisma.order.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Order')
    const order = await app.prisma.order.update({ where: { id }, data: parsed.data, include: orderInclude })
    return reply.send(serializeOrder(order))
  })

  // ── DELETE /api/v1/orders/:id ────────────────────────────────
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await app.prisma.order.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Order')
    await app.prisma.order.delete({ where: { id } })
    return reply.code(204).send()
  })
}
