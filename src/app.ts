import Fastify           from 'fastify'
import cors              from '@fastify/cors'
import helmet            from '@fastify/helmet'
import multipart         from '@fastify/multipart'
import swagger           from '@fastify/swagger'
import scalarUi          from '@scalar/fastify-api-reference'

import prismaPlugin       from './plugins/prisma.js'
import jwtPlugin          from './plugins/jwt.js'
import cloudinaryPlugin   from './plugins/cloudinary.js'

import authRoutes         from './modules/auth/auth.routes.js'
import customerAuthRoutes from './modules/custumer-auth/custumer-auth.routes.js'
import productsRoutes     from './modules/products/products.routes.js'
import ordersRoutes       from './modules/orders/orders.routes.js'
import customersRoutes    from './modules/customers/customers.routes.js'
import dashboardRoutes    from './modules/dashboard/dashboard.routes.js'
import analyticsRoutes    from './modules/analytics/analytics.routes.js'
import settingsRoutes     from './modules/settings/settings.routes.js'
import uploadRoutes       from './modules/upload/upload.routes.js'
import requestsRoutes from './modules/requests/requests.routes.js'
import commentsRoutes from './modules/products/comments.routes.js'

import { config } from './config.js'

export async function buildApp() {
  const app = Fastify({
    logger: {
      level:     config.isDev ? 'info' : 'warn',
      transport: config.isDev
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  })

  await app.register(helmet, { contentSecurityPolicy: false })

  // ── CORS — allow any origin in dev, strict list in prod ───────────────────
  const allowedOrigins = config.corsOrigins
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      cb(new Error(`Origin ${origin} not allowed`), false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } })

  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: { title: 'SilkShop API', description: 'REST API for SilkShop', version: '1.0.0' },
      servers: [{ url: `http://localhost:${config.port}` }],
      components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
      security: [{ bearerAuth: [] }],
      tags: [
        { name: 'Auth',      description: 'Admin authentication'   },
        { name: 'Customer',  description: 'Customer auth & orders' },
        { name: 'Products',  description: 'Product management'     },
        { name: 'Orders',    description: 'Order management'       },
        { name: 'Customers', description: 'Customer management'    },
        { name: 'Dashboard', description: 'Dashboard summary'      },
        { name: 'Analytics', description: 'Analytics & reporting'  },
        { name: 'Settings',  description: 'Store settings'         },
        { name: 'Upload',    description: 'File upload'            },
      ],
    },
  })

  await app.register(scalarUi, {
    routePrefix: '/docs',
    configuration: { title: 'SilkShop API', theme: 'kepler', layout: 'modern' },
  })

  await app.register(prismaPlugin)
  await app.register(jwtPlugin)
  await app.register(cloudinaryPlugin)

  app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  await app.register(async (api) => {
    api.register(authRoutes,         { prefix: '/auth'      })
    api.register(customerAuthRoutes, { prefix: '/customer'  })
    api.register(productsRoutes,     { prefix: '/products'  })
    api.register(ordersRoutes,       { prefix: '/orders'    })
    api.register(customersRoutes,    { prefix: '/customers' })
    api.register(dashboardRoutes,    { prefix: '/dashboard' })
    api.register(analyticsRoutes,    { prefix: '/analytics' })
    api.register(settingsRoutes,     { prefix: '/settings'  })
    api.register(uploadRoutes,       { prefix: '/upload'    })
    api.register(requestsRoutes,     { prefix: '/requests'  })
    api.register(commentsRoutes,     { prefix: '/products'  })
  }, { prefix: '/api/v1' })

 app.setErrorHandler((err: any, _req, reply) => {
  app.log.error(err)
  reply.code(err.statusCode ?? 500).send({
    error: 'ERROR', message: config.isDev ? err.message : 'Something went wrong',
  })
})

  return app
}