import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { badRequest, unauthorized, notFound } from '../../shared/errors.js'

const CreateCommentSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text:   z.string().min(1).max(1000),
})

export default async function commentsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // GET /api/v1/products/:id/comments — PUBLIC
  app.get('/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string }

    const comments = await (app.prisma as any).comment.findMany({
      where:   { productId: id },
      include: { customer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    // Aggregate rating
    const total = comments.length
    const avg   = total > 0
      ? comments.reduce((s: number, c: any) => s + c.rating, 0) / total
      : 0

    return reply.send({ comments, total, avgRating: Math.round(avg * 10) / 10 })
  })

  // POST /api/v1/products/:id/comments — Customer JWT required
  app.post('/:id/comments', guard, async (req, reply) => {
    const user = req.user as any
    if (user.role !== 'CUSTOMER') return unauthorized(reply, 'Customer token required')

    const { id } = req.params as { id: string }
    const parsed  = CreateCommentSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    // Check product exists
    const product = await app.prisma.product.findUnique({ where: { id } })
    if (!product) return notFound(reply, 'Product')

    // One comment per customer per product
    const existing = await (app.prisma as any).comment.findFirst({
      where: { productId: id, customerId: user.sub },
    })
    if (existing) return badRequest(reply, 'You have already reviewed this product')

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

  // DELETE /api/v1/products/:id/comments/:commentId — own comment only
  app.delete('/:id/comments/:commentId', guard, async (req, reply) => {
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