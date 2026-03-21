import type { FastifyReply } from 'fastify'

export function badRequest(reply: FastifyReply, message: string) {
  return reply.code(400).send({ error: 'BAD_REQUEST', message })
}
export function unauthorized(reply: FastifyReply, message = 'Unauthorized') {
  return reply.code(401).send({ error: 'UNAUTHORIZED', message })
}
export function forbidden(reply: FastifyReply, message = 'Forbidden') {
  return reply.code(403).send({ error: 'FORBIDDEN', message })
}
export function notFound(reply: FastifyReply, resource = 'Resource') {
  return reply.code(404).send({ error: 'NOT_FOUND', message: `${resource} not found` })
}
export function conflict(reply: FastifyReply, message: string) {
  return reply.code(409).send({ error: 'CONFLICT', message })
}
export function serverError(reply: FastifyReply, message = 'Internal server error') {
  return reply.code(500).send({ error: 'INTERNAL_ERROR', message })
}