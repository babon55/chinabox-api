import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { badRequest, unauthorized, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'

const CreateCommentSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text:   z.string().min(1).max(1000),
})

export default async function commentsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── ADMIN: GET /api/v1/products/comments/all ──────────────────────────────
  // ⚠️ Must be FIRST — before /:id routes or Fastify treats "comments" as :id
  app.get('/comments/all', {
    ...guard,
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'ADMIN') return unauthorized(reply, 'Admin only')

    const { productId, page = '1', limit = '20' } = req.query as {
      productId?: string
      page?:      string
      limit?:     string
    }

    const where = productId ? { productId } : {}
    const skip  = (Number(page) - 1) * Number(limit)

    const [comments, total] = await Promise.all([
      (app.prisma as any).comment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true } },
          product:  { select: { id: true, nameTk: true, nameRu: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      (app.prisma as any).comment.count({ where }),
    ])

    return reply.send({ comments, total, page: Number(page), limit: Number(limit) })
  })

  // ── PUBLIC: GET /api/v1/products/:id/comments ─────────────────────────────
  app.get('/:id/comments', {
    rateLimit: { max: config.rateLimits.products.max, timeWindow: config.rateLimits.products.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    const comments = await (app.prisma as any).comment.findMany({
      where:   { productId: id },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const total = comments.length
    const avg   = total > 0
      ? comments.reduce((s: number, c: any) => s + c.rating, 0) / total
      : 0

    return reply.send({ comments, total, avgRating: Math.round(avg * 10) / 10 })
  })

  // ── CUSTOMER: POST /api/v1/products/:id/comments ──────────────────────────
  app.post('/:id/comments', {
    ...guard,
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const { id } = req.params as { id: string }
    const parsed  = CreateCommentSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    const product = await app.prisma.product.findUnique({ where: { id } })
    if (!product) return notFound(reply, 'Product')

    // ✅ Removed: one-comment-per-customer check (multiple reviews now allowed)

    const comment = await (app.prisma as any).comment.create({
      data: {
        productId:  id,
        customerId: user.sub,
        rating:     parsed.data.rating,
        text:       parsed.data.text,
      },
      include: { customer: { select: { id: true, name: true } } },
    })

    return reply.code(201).send(comment)
  })

  // ── DELETE /api/v1/products/:id/comments/:commentId ───────────────────────
  app.delete('/:id/comments/:commentId', {
    ...guard,
    rateLimit: { max: config.rateLimits.customer.max, timeWindow: config.rateLimits.customer.timeWindow }
  }, async (req, reply) => {
    const user = req.user as any
    const { commentId } = req.params as { id: string; commentId: string }

    const comment = await (app.prisma as any).comment.findUnique({ where: { id: commentId } })
    if (!comment) return notFound(reply, 'Comment')
    if (comment.customerId !== user.sub && user.role !== 'ADMIN') {
      return unauthorized(reply, 'Not your comment')
    }

    await (app.prisma as any).comment.delete({ where: { id: commentId } })
    return reply.code(204).send()
  })
}