import fp from 'fastify-plugin'
import { v2 as cloudinary } from 'cloudinary'
import type { FastifyInstance } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    cloudinary: typeof cloudinary
  }
}

export default fp(async (app: FastifyInstance) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  })

  app.decorate('cloudinary', cloudinary)
  app.log.info('☁️  Cloudinary connected')
})