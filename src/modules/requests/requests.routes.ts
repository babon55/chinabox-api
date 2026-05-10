import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { badRequest, notFound } from '../../shared/errors.js'
import { config } from '../../config.js'

const CreateRequestSchema = z.object({
  nameTk:       z.string().min(1),
  nameRu:       z.string().min(1),
  description:  z.string().optional(),
  imageUrl:     z.string().optional().nullable(),
  contactName:  z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
})

const UpdateRequestSchema = z.object({
  status:    z.enum(['NEW', 'SEEN', 'ADDED', 'REJECTED']).optional(),
  adminNote: z.string().optional(),
})

const QuerySchema = z.object({
  status: z.enum(['NEW', 'SEEN', 'ADDED', 'REJECTED']).optional(),
  page:   z.coerce.number().min(1).default(1),
  limit:  z.coerce.number().min(1).max(50).default(20),
})

export default async function requestsRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // POST /api/v1/requests — PUBLIC
  app.post('/', {
    rateLimit: { max: config.rateLimits.publicRequests.max, timeWindow: config.rateLimits.publicRequests.timeWindow }
  }, async (req, reply) => {
    const parsed = CreateRequestSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    // ✅ FIX 13 (bundled): removed (app.prisma as any) cast
    const request = await app.prisma.productRequest.create({ data: parsed.data })
    return reply.code(201).send(request)
  })

  // GET /api/v1/requests — ADMIN only
  app.get('/', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const q = QuerySchema.safeParse(req.query)
    if (!q.success) return badRequest(reply, q.error.message)
    const { status, page, limit } = q.data

    const where = status ? { status } : {}

    const [items, total] = await Promise.all([
      app.prisma.productRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      app.prisma.productRequest.count({ where }),
    ])

    return reply.send({ items, total, page, limit, pages: Math.ceil(total / limit) })
  })

  // PATCH /api/v1/requests/:id — ADMIN only
  app.patch('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const parsed = UpdateRequestSchema.safeParse(req.body)
    if (!parsed.success) return badRequest(reply, parsed.error.message)

    // ✅ FIX 6: removed findUnique before update — catch P2025 instead
    //    Was: 2 DB round-trips. Now: 1.
    try {
      const updated = await app.prisma.productRequest.update({
        where: { id },
        data:  parsed.data,
      })
      return reply.send(updated)
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Request')
      throw e
    }
  })

  // DELETE /api/v1/requests/:id — ADMIN only
  app.delete('/:id', {
    ...guard,
    rateLimit: { max: config.rateLimits.admin.max, timeWindow: config.rateLimits.admin.timeWindow }
  }, async (req, reply) => {
    const { id } = req.params as { id: string }

    // ✅ FIX 6: removed findUnique before delete — catch P2025 instead
    //    Was: 2 DB round-trips. Now: 1.
    try {
      await app.prisma.productRequest.delete({ where: { id } })
      return reply.code(204).send()
    } catch (e: any) {
      if (e.code === 'P2025') return notFound(reply, 'Request')
      throw e
    }
  })
}