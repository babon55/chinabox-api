const required = (key: string): string => {
  const v = process.env[key]
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

export const config = {
  port:     parseInt(process.env.PORT ?? '3001'),
  host:     process.env.HOST ?? '0.0.0.0',
  nodeEnv:  process.env.NODE_ENV ?? 'development',
  isDev:    (process.env.NODE_ENV ?? 'development') === 'development',

  redisUrl: process.env.REDIS_URL,  // Optional: for shared rate limiting in production

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),

  jwt: {
    accessSecret:     required('JWT_ACCESS_SECRET'),
    refreshSecret:    required('JWT_REFRESH_SECRET'),
    accessExpiresIn:  process.env.JWT_ACCESS_EXPIRES  ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },

  rateLimits: {
    // Default limit for all routes (can be overridden by specific routes)
    default: {
      max: parseInt(process.env.RATE_LIMIT_DEFAULT ?? '200'),
      timeWindow: process.env.RATE_LIMIT_WINDOW ?? '1 minute',
    },

    // Admin login - very strict to prevent brute force
    auth: {
      max: parseInt(process.env.RATE_LIMIT_AUTH ?? '5'),
      timeWindow: process.env.RATE_LIMIT_AUTH_WINDOW ?? '1 minute',
    },

    // Refresh token endpoint (both admin and customer)
    refresh: {
      max: parseInt(process.env.RATE_LIMIT_REFRESH ?? '10'),
      timeWindow: process.env.RATE_LIMIT_REFRESH_WINDOW ?? '1 minute',
    },

    // Customer registration and login
    customerAuth: {
      max: parseInt(process.env.RATE_LIMIT_CUSTOMER_AUTH ?? '10'),
      timeWindow: process.env.RATE_LIMIT_CUSTOMER_AUTH_WINDOW ?? '1 minute',
    },

    // Admin upload (product images, delete)
    upload: {
      max: parseInt(process.env.RATE_LIMIT_UPLOAD ?? '10'),
      timeWindow: process.env.RATE_LIMIT_UPLOAD_WINDOW ?? '1 minute',
    },

    // Public upload for product requests (no auth)
    publicUpload: {
      max: parseInt(process.env.RATE_LIMIT_PUBLIC_UPLOAD ?? '5'),
      timeWindow: process.env.RATE_LIMIT_PUBLIC_UPLOAD_WINDOW ?? '1 minute',
    },

    // Admin management endpoints (orders, customers, dashboard, analytics, settings, requests)
    admin: {
      max: parseInt(process.env.RATE_LIMIT_ADMIN ?? '60'),
      timeWindow: process.env.RATE_LIMIT_ADMIN_WINDOW ?? '1 minute',
    },

    // Customer-specific operations (customer orders, comments)
    customer: {
      max: parseInt(process.env.RATE_LIMIT_CUSTOMER ?? '60'),
      timeWindow: process.env.RATE_LIMIT_CUSTOMER_WINDOW ?? '1 minute',
    },

    // Public product browsing endpoints
    products: {
      max: parseInt(process.env.RATE_LIMIT_PRODUCTS ?? '200'),
      timeWindow: process.env.RATE_LIMIT_PRODUCTS_WINDOW ?? '1 minute',
    },

    // Public product request submission (no auth)
    publicRequests: {
      max: parseInt(process.env.RATE_LIMIT_PUBLIC_REQUESTS ?? '10'),
      timeWindow: process.env.RATE_LIMIT_PUBLIC_REQUESTS_WINDOW ?? '1 minute',
    },
  } as const,
} as const