import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { badRequest, unauthorized, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'

const CreateCommentSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text:   z.string().min(1).max(1000),
  images: z.array(z.string().url()).max(3).optional().default([]),
})

// ✅ FIX 5: pagination schema for public comments
const CommentQuerySchema = z.object({
  page:  z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
})

// ✅ FIX 5: pagination schema for admin all-comments view
const AdminCommentQuerySchema = z.object({
  productId: z.string().optional(),
  page:      z.coerce.number().min(1).default(1),
  limit:     z.coerce.number().min(1).max(50).default(20),
})

export default async function commentsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── ADMIN: GET /api/v1/products/comments/all ──────────────────────────────
  // ⚠️  Must be FIRST — before /:id routes or Fastify treats "comments" as :id
  app.get('/comments/all', {
    ...guard,
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'ADMIN') return unauthorized(reply, 'Admin only')

    const q = AdminCommentQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { productId, page, limit } = q.data

    const where = productId ? { productId } : {}

    // ✅ FIX 5: count runs in SQL, not in JS after fetching all rows
    const [comments, total] = await Promise.all([
      app.prisma.comment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          product:  { select: { id: true, nameTk: true, nameRu: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.comment.count({ where }),
    ])

    return reply.send({ comments, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // ── PUBLIC: GET /api/v1/products/:id/comments ─────────────────────────────
  app.get('/:id/comments', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const q = CommentQuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { page, limit } = q.data

    // ✅ FIX 5: was fetching ALL comments into memory then counting/averaging in JS.
    //    Now: count + aggregate run in SQL, only the requested page is fetched.
    //    A product with 5000 reviews now returns in milliseconds instead of seconds.
    const [comments, total, agg] = await Promise.all([
      app.prisma.comment.findMany({
        where:   { productId: id },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.comment.count({ where: { productId: id } }),
      app.prisma.comment.aggregate({
        where: { productId: id },
        _avg:  { rating: true },
      }),
    ])

    const avgRating = agg._avg.rating != null
      ? Math.round(agg._avg.rating * 10) / 10
      : 0

    return reply.send({
      comments,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      avgRating,
    })
  })

  // ── CUSTOMER: POST /api/v1/products/:id/comments ──────────────────────────
  app.post('/:id/comments', {
    ...guard,
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const { id }  = req.params as { id: string }
    const parsed  = CreateCommentSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    const product = await app.prisma.product.findUnique({ where: { id } })
    if (!product) return notFound(reply, 'Product')

    // ✅ FIX 13: was (app.prisma as any).comment — now properly typed
    const comment = await app.prisma.comment.create({
      data: {
        productId:  id,
        customerId: user.sub,
        rating:     parsed.data.rating,
        text:       parsed.data.text,
        images:     parsed.data.images,
      },
      include: { customer: { select: { id: true, name: true } } },
    })

    return reply.code(201).send(comment)
  })

  // ── DELETE /api/v1/products/:id/comments/:commentId ──────────────────────
  app.delete('/:id/comments/:commentId', {
    ...guard,
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    const { commentId } = req.params as { id: string; commentId: string }

    // ✅ FIX 13: was (app.prisma as any).comment — now properly typed
    const comment = await app.prisma.comment.findUnique({ where: { id: commentId } })
    if (!comment) return notFound(reply, 'Comment')
    if (comment.customerId !== user.sub && user.role !== 'ADMIN') {
      return unauthorized(reply, 'Not your comment')
    }

    await app.prisma.comment.delete({ where: { id: commentId } })
    return reply.code(204).send()
  })
}