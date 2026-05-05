import type { FastifyInstance } from 'fastify'
import { badRequest, serverError } from '../../shared/errors.js'
import { config } from '../../config.js'

export default async function uploadRoutes(app: FastifyInstance) {
  const guard = { onRequest: [app.authenticate] }

  // ── Admin: upload product image (requires JWT) ─────────────────────────────
  app.post('/product', {
    ...guard,
    rateLimit: { max: config.rateLimits.upload.max, timeWindow: config.rateLimits.upload.timeWindow }
  }, async (req, reply) => {
    if (!req.isMultipart()) {
      return badRequest(reply, 'Request must be multipart/form-data')
    }

    let data: any
    try {
      data = await req.file()
    } catch (e: any) {
      return badRequest(reply, 'Could not parse multipart form: ' + e.message)
    }

    if (!data) return badRequest(reply, 'No file uploaded — send field name "file"')

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(data.mimetype)) {
      return badRequest(reply, `Invalid type: ${data.mimetype}. Allowed: jpeg, png, webp, gif`)
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length === 0) {
      return badRequest(reply, 'File is empty — the stream was consumed before upload')
    }

    try {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = app.cloudinary.uploader.upload_stream(
          {
            folder: 'chinaexpress/products',
            transformation: [
              { width: 800, height: 800, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Cloudinary upload failed'))
            resolve(result as { secure_url: string; public_id: string })
          }
        )
        stream.end(buffer)
      })

      return reply.code(201).send({ url: result.secure_url, publicId: result.public_id })
    } catch (e: any) {
      app.log.error('Cloudinary error: ' + e.message)
      return serverError(reply, 'Image upload failed: ' + e.message)
    }
  })

  // ── PUBLIC: upload request image (no JWT — for product request form) ────────
  app.post('/request', {
    rateLimit: { max: config.rateLimits.publicUpload.max, timeWindow: config.rateLimits.publicUpload.timeWindow }
  }, async (req, reply) => {
    if (!req.isMultipart()) {
      return badRequest(reply, 'Request must be multipart/form-data')
    }

    let data: any
    try {
      data = await req.file()
    } catch (e: any) {
      return badRequest(reply, 'Could not parse multipart form: ' + e.message)
    }

    if (!data) return badRequest(reply, 'No file uploaded — send field name "file"')

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(data.mimetype)) {
      return badRequest(reply, `Invalid type: ${data.mimetype}`)
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length === 0) return badRequest(reply, 'File is empty')

    try {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = app.cloudinary.uploader.upload_stream(
          {
            folder: 'chinaexpress/requests',
            transformation: [
              { width: 800, height: 800, crop: 'limit' },
              { quality: 'auto', fetch_format: 'auto' },
            ],
          },
          (error, result) => {
            if (error || !result) return reject(error ?? new Error('Upload failed'))
            resolve(result as { secure_url: string; public_id: string })
          }
        )
        stream.end(buffer)
      })

      return reply.code(201).send({ url: result.secure_url, publicId: result.public_id })
    } catch (e: any) {
      return serverError(reply, 'Image upload failed: ' + e.message)
    }
  })

  // ── Admin: delete image ────────────────────────────────────────────────────
  app.delete('/product', {
    ...guard,
    rateLimit: { max: config.rateLimits.upload.max, timeWindow: config.rateLimits.upload.timeWindow }
  }, async (req, reply) => {
    const { publicId } = req.body as { publicId?: string }
    if (!publicId) return badRequest(reply, 'publicId required')
    try {
      await app.cloudinary.uploader.destroy(publicId)
      return reply.code(204).send()
    } catch (e: any) {
      return serverError(reply, 'Failed to delete image')
    }
  })
}