export function badRequest(reply, message) {
    return reply.code(400).send({ error: 'BAD_REQUEST', message });
}
export function unauthorized(reply, message = 'Unauthorized') {
    return reply.code(401).send({ error: 'UNAUTHORIZED', message });
}
export function forbidden(reply, message = 'Forbidden') {
    return reply.code(403).send({ error: 'FORBIDDEN', message });
}
export function notFound(reply, resource = 'Resource') {
    return reply.code(404).send({ error: 'NOT_FOUND', message: `${resource} not found` });
}
export function conflict(reply, message) {
    return reply.code(409).send({ error: 'CONFLICT', message });
}
export function serverError(reply, message = 'Internal server error') {
    return reply.code(500).send({ error: 'INTERNAL_ERROR', message });
}
//# sourceMappingURL=errors.js.map