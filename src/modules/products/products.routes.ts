import type { FastifyInstance } from 'fastify'
import { ProductCreateSchema, ProductUpdateSchema, ProductQuerySchema } from '../../shared/types.js'
import { badRequest, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'

export default async function productsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── PUBLIC ────────────────────────────────────────────────────────────────

  // GET /api/v1/products
  app.get('/', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const q = ProductQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)

    const { status, search, page, limit, category, sort, exclude } = q.data

    // ── Resolve category filter: if parent, include all children ──────────
    let categoryFilter: object = {}
    if (category) {
      const cat = await app.prisma.category.findUnique({
        where:   { id: category },
        include: { children: { select: { id: true } } },
      })
      const ids = cat?.children?.length
        ? cat.children.map(c => c.id)
        : [category]
      categoryFilter = { categoryId: { in: ids } }
    }

    const where = {
      status: status ?? ('ACTIVE' as const),
      ...(exclude ? { id: { not: exclude } } : {}),
      ...categoryFilter,
      ...(search ? {
        OR: [
          { nameTk: { contains: search, mode: 'insensitive' as const } },
          { nameRu: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const orderBy = (() => {
      switch (sort) {
        case 'price_asc':  return { price: 'asc'  as const }
        case 'price_desc': return { price: 'desc' as const }
        case 'popular':    return { sold:  'desc' as const }
        default:           return { createdAt: 'desc' as const }
      }
    })()

    const [itemsRaw, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include:  { category: { include: { parent: true } } },
        orderBy,
        skip:     (page - 1) * limit,
        take:     limit,
      }),
      app.prisma.product.count({ where }),
    ])

    let items = itemsRaw.map(p => ({
      ...p,
      price:   Number(p.price),
      weightG: p.weightG != null ? Number(p.weightG) : null,
    }))

    if (sort === 'random') {
      items = items.sort(() => Math.random() - 0.5)
    }

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/products/categories/all — nested tree for client sidebar
  app.get('/categories/all', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (_req, reply) => {
    const cats = await app.prisma.category.findMany({
      where:   { parentId: null },
      include: { children: { orderBy: { nameTk: 'asc' } } },
      orderBy: { nameTk: 'asc' },
    })
    return reply.send(cats)
  })

  // GET /api/v1/products/categories/flat — flat list for admin selects
  app.get('/categories/flat', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (_req, reply) => {
    const cats = await app.prisma.category.findMany({ orderBy: { nameTk: 'asc' } })
    return reply.send(cats)
  })

  // GET /api/v1/products/:id
  app.get('/:id', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const product = await app.prisma.product.findUnique({
      where:   { id },
      include: { category: { include: { parent: true } } },
    })
    if (!product) return notFound(reply, 'Product')
    return reply.send({
      ...product,
      price:   Number(product.price),
      weightG: product.weightG != null ? Number(product.weightG) : null,
    })
  })

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  app.get('/admin/all', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const q = ProductQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { status, search, page, limit } = q.data

    const where = {
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { nameTk: { contains: search, mode: 'insensitive' as const } },
          { nameRu: { contains: search, mode: 'insensitive' as const } },
          { id:     { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [itemsRaw, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include: { category: { include: { parent: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.product.count({ where }),
    ])
    const items = itemsRaw.map(p => ({
      ...p,
      price:   Number(p.price),
      weightG: p.weightG != null ? Number(p.weightG) : null,
    }))

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // POST /api/v1/products
  app.post('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = ProductCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const product = await app.prisma.product.create({
      data:    parsed.data,
      include: { category: { include: { parent: true } } },
    })
    return reply.code(201).send({
      ...product,
      price:   Number(product.price),
      weightG: product.weightG != null ? Number(product.weightG) : null,
    })
  })

  // PATCH /api/v1/products/:id
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id }  = req.params as { id: string }
    const parsed  = ProductUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Product')
    const product = await app.prisma.product.update({
      where:   { id },
      data:    parsed.data,
      include: { category: { include: { parent: true } } },
    })
    return reply.send({
      ...product,
      price:   Number(product.price),
      weightG: product.weightG != null ? Number(product.weightG) : null,
    })
  })

  // DELETE /api/v1/products/:id
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Product')
    await app.prisma.product.delete({ where: { id } })
    return reply.code(204).send()
  })

  // ── ADMIN CATEGORIES CRUD ────────────────────────────────────────────────

  // POST /api/v1/products/categories
  app.post('/categories', guard, async (req, reply) => {
    const b = req.body as { nameTk: string; nameRu: string; parentId?: string | null }
    if (!b.nameTk || !b.nameRu) return badRequest(reply, 'nameTk and nameRu required')
    const cat = await app.prisma.category.create({
      data: { nameTk: b.nameTk, nameRu: b.nameRu, parentId: b.parentId ?? null },
    })
    return reply.code(201).send(cat)
  })

  // PATCH /api/v1/products/categories/:id
  app.patch('/categories/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    const b = req.body as { nameTk?: string; nameRu?: string; parentId?: string | null }
    const cat = await app.prisma.category.update({ where: { id }, data: b })
    return reply.send(cat)
  })

  // DELETE /api/v1/products/categories/:id
  app.delete('/categories/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    // Promote orphaned subcategories to root before deleting
    await app.prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } })
    await app.prisma.category.delete({ where: { id } })
    return reply.code(204).send()
  })
}