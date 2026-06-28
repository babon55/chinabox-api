import type { FastifyInstance } from 'fastify'
import { ProductCreateSchema, ProductUpdateSchema, ProductQuerySchema } from '../../shared/types.js'
import { badRequest, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'
import { ProductBulkImportSchema } from '../../shared/types.js'
import { ProductBulkImportRowSchema } from '../../shared/types.js'

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

    // Resolve category filter: if parent, include all children
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
        case 'price_asc':  return { price:     'asc'  as const }
        case 'price_desc': return { price:     'desc' as const }
        case 'popular':    return { sold:      'desc' as const }
        default:           return { createdAt: 'desc' as const }
      }
    })()

    const [itemsRaw, total] = await Promise.all([
      app.prisma.product.findMany({
        where,
        include:  { category: { include: { parent: true } } },
        orderBy,
        skip:     (page - 1) * limit,
        take:     sort === 'random' ? limit * 3 : limit, // fetch extra pool for random
      }),
      app.prisma.product.count({ where }),
    ])

    // Shuffle within the fetched pool when sort=random, then take the page size
    const pool = sort === 'random'
      ? itemsRaw.sort(() => Math.random() - 0.5).slice(0, limit)
      : itemsRaw

    const items = pool.map(p => ({
      ...p,
      price:   Number(p.price),
      weightG: p.weightG != null ? Number(p.weightG) : null,
    }))

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

  // POST /api/v1/products/bulk-import
  app.post('/bulk-import', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const parsed = ProductBulkImportSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    const allCategories = await app.prisma.category.findMany()
    const categoryMap = new Map<string, string>()
    for (const c of allCategories) {
      categoryMap.set(c.nameTk.trim().toLowerCase(), c.id)
      categoryMap.set(c.nameRu.trim().toLowerCase(), c.id)
    }

    const results: { row: number; status: 'created' | 'failed'; error?: string; id?: string }[] = []

    for (let i = 0; i < parsed.data.rows.length; i++) {
      const rowNum = i + 2 // row 1 = header, first data row = row 2

      const rowParsed = ProductBulkImportRowSchema.safeParse(parsed.data.rows[i])
      if (!rowParsed.success) {
        const msg = rowParsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ')
        results.push({ row: rowNum, status: 'failed', error: msg })
        continue
      }
      const row = rowParsed.data

      const categoryId = categoryMap.get(row.categoryName.trim().toLowerCase())
      if (!categoryId) {
        results.push({ row: rowNum, status: 'failed', error: `Category "${row.categoryName}" not found` })
        continue
      }

      const imageUrls = row.imageUrls
        ? row.imageUrls.split(';').map(u => u.trim()).filter(Boolean)
        : []

      try {
        const product = await app.prisma.product.create({
          data: {
            nameTk:        row.nameTk,
            nameRu:        row.nameRu,
            descriptionTk: row.descriptionTk ?? null,
            descriptionRu: row.descriptionRu ?? null,
            categoryId,
            image:         '📦',
            imageUrl:      imageUrls[0] ?? null,
            imageUrls,
            price:         row.price,
            weightG:       row.weightG ?? null,
            stock:         row.stock ?? 999,
            status:        row.status ?? 'ACTIVE',
            markup:        row.markup ?? 50,
            options:       [],
          },
        })
        results.push({ row: rowNum, status: 'created', id: product.id })
      } catch (e: any) {
        results.push({ row: rowNum, status: 'failed', error: e.message ?? 'Unknown error' })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const failed  = results.filter(r => r.status === 'failed').length

    return reply.send({ created, failed, results })
  })

  // PATCH /api/v1/products/:id
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id }  = req.params as { id: string }
    const parsed  = ProductUpdateSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    // ✅ FIX 6: removed findUnique check — update directly, catch P2025
    //    Was: 2 DB round-trips (findUnique + update)
    //    Now: 1 DB round-trip (update, 404 if not found)
    try {
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
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Product')
      throw e
    }
  })

  // DELETE /api/v1/products/:id
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    // Check if product has order lines
    const orderLineCount = await app.prisma.orderLine.count({
      where: { productId: id },
    })

    if (orderLineCount > 0) {
      return badRequest(reply, `Cannot delete: this product is part of ${orderLineCount} order(s). Archive it instead.`)
    }

    try {
      await app.prisma.product.delete({ where: { id } })
      return reply.code(204).send()
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Product')
      throw e
    }
  })

  // ── ADMIN CATEGORIES CRUD ─────────────────────────────────────────────────

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

    // ✅ FIX 6: catch P2025 instead of findUnique first
    try {
      const cat = await app.prisma.category.update({ where: { id }, data: b })
      return reply.send(cat)
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Category')
      throw e
    }
  })

  // DELETE /api/v1/products/categories/:id
  app.delete('/categories/:id', guard, async (req, reply) => {
    const { id } = req.params as { id: string }

    // Check if any products are assigned to this category or its children
    const children = await app.prisma.category.findMany({
      where:  { parentId: id },
      select: { id: true },
    })
    const allIds = [id, ...children.map(c => c.id)]

    const productCount = await app.prisma.product.count({
      where: { categoryId: { in: allIds } },
    })

    if (productCount > 0) {
      return badRequest(reply, `Cannot delete: ${productCount} product(s) are assigned to this category. Move or delete them first.`)
    }

    // Safe to delete — promote orphaned subcategories to root first
    await app.prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } })

    try {
      await app.prisma.category.delete({ where: { id } })
      return reply.code(204).send()
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Category')
      throw e
    }
  })
}