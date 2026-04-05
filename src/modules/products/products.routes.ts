import type { FastifyInstance } from 'fastify'
import { ProductCreateSchema, ProductUpdateSchema, ProductQuerySchema } from '../../shared/types.js'
import { badRequest, notFound } from '../../shared/errors.js'

export default async function productsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── PUBLIC (no auth needed — storefront browsing) ─────────────────────────

  // GET /api/v1/products — only ACTIVE for public
  app.get('/', async (req, reply) => {
    const q = ProductQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { status, search, page, limit } = q.data

    const where = {
      status: status ?? ('ACTIVE' as const),
      ...(search ? {
        OR: [
          { nameTk: { contains: search, mode: 'insensitive' as const } },
          { nameRu: { contains: search, mode: 'insensitive' as const } },
        ],
      } : {}),
    }

    const [items, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.product.count({ where }),
    ])

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // GET /api/v1/products/categories/all — PUBLIC
  app.get('/categories/all', async (_req, reply) => {
    const cats = await app.prisma.category.findMany({ orderBy: { nameTk: 'asc' } })
    return reply.send(cats)
  })

  // GET /api/v1/products/:id — PUBLIC
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const product = await app.prisma.product.findUnique({
      where: { id },
      include: { category: true }
    })
    if (!product) return notFound(reply, 'Product')
    return reply.send(product)
  })

  // ── ADMIN only (require JWT) ───────────────────────────────────────────────

  // Admin list — all statuses
  app.get('/admin/all', guard, async (req, reply) => {
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

    const [items, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include: { category: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      app.prisma.product.count({ where }),
    ])

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // POST /api/v1/products
  app.post('/', guard, async (req, reply) => {
    const parsed = ProductCreateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const product = await app.prisma.product.create({
      data: parsed.data,
      include: { category: true }
    })
    return reply.code(201).send(product)
  })

  // PATCH /api/v1/products/:id
  app.patch('/:id', guard, async (req, reply) => {
    const { id }  = req.params as { id: string }
    const parsed  = ProductUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)
    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Product')
    const product = await app.prisma.product.update({
      where: { id },
      data: parsed.data,
      include: { category: true }
    })
    return reply.send(product)
  })

  // DELETE /api/v1/products/:id
  app.delete('/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }
    const exists = await app.prisma.product.findUnique({ where: { id } })
    if (!exists) return notFound(reply, 'Product')
    await app.prisma.product.delete({ where: { id } })
    return reply.code(204).send()
  })
}