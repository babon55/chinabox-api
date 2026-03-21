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

  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),

  jwt: {
    accessSecret:     required('JWT_ACCESS_SECRET'),
    refreshSecret:    required('JWT_REFRESH_SECRET'),
    accessExpiresIn:  process.env.JWT_ACCESS_EXPIRES  ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  },
} as const