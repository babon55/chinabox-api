# CLAUDE.md

Этот файл предоставляет руководство для Claude Code (claude.ai/code) при работе с кодом в этом репозитории.

## Обзор проекта

SilkShop — это REST API, построенный на **Fastify**, **Prisma** и **PostgreSQL**. Это бэкенд для электронной коммерции туркменского рынка с поддержкой двух языков (туркменский/русский). API включает аутентификацию, управление товарами, заказами, клиентами, аналитику и загрузку файлов (Cloudinary).

## Технологический стек

- **Рантайм**: Node.js 20+, ES Modules (type: module)
- **Фреймворк**: Fastify 5.x
- **База данных**: PostgreSQL с Prisma ORM
- **Валидация**: Zod
- **Аутентификация**: JWT (access + refresh токены)
- **Хранение файлов**: Cloudinary
- **Документация**: Swagger + Scalar UI
- **Язык**: TypeScript (strict mode)

## Основные команды

### Разработка
```bash
# Запуск dev-сервера с hot reload
pnpm dev

# Production сборка
pnpm build

# Запуск production-сервера
pnpm start
```

### База данных
```bash
# Применить изменения схемы (без истории миграций)
pnpm db:push

# Создать и применить новую миграцию
pnpm db:migrate

# Заполнить базу тестовыми данными
pnpm db:seed

# Открыть Prisma Studio (GUI для БД)
pnpm db:studio
```

### Сборка и типы
```bash
# Компиляция TypeScript
pnpm build  # выход в ./dist

# Проверка типов (входит в build)
pnpm build  # TypeScript в strict mode
```

## Архитектура

### Высокоуровневая структура

```
src/
├── main.ts              # Точка входа: загружает env, строит app, запускает сервер
├── app.ts               # Конфигурация Fastify: плагины, middleware, маршруты
├── config.ts            # Конфиг из переменных окружения
├── plugins/             # Fastify плагины (декоратируют app)
│   ├── prisma.ts        # Добавляет app.prisma (синглтон PrismaClient)
│   ├── jwt.ts           # Добавляет app.authenticate middleware
│   └── cloudinary.ts    # Добавляет app.cloudinary (инстанс Cloudinary)
├── modules/             # Модули признаков (регистрируют свои маршруты)
│   ├── auth/            # Аутентификация админа (login, refresh, profile)
│   ├── custumer-auth/   # Аутентификация клиента (register, login)
│   ├── products/        # CRUD товаров, категории, публичный листинг
│   ├── products/comments.routes.ts  # Комментарии к товарам (вложенный маршрут)
│   ├── orders/          # Управление заказами (с позициями и опциями)
│   ├── customers/       # CRUD клиентов (вид для админа)
│   ├── dashboard/       # Статистика дашборда
│   ├── analytics/       # Аналитика продаж и заказов
│   ├── settings/        # Настройки магазина (синглтон), обновление аккаунта
│   ├── upload/          # Загрузка файлов (Cloudinary)
│   └── requests/        # Запросы товаров от клиентов
└── shared/
    ├── types.ts         # Все Zod схемы валидации
    └── errors.ts        # Хелперы HTTP ошибок (badRequest, notFound и др.)

prisma/
├── schema.prisma        # Схема базы данных
└── seed.ts              # Скрипт заполнения БД
```

### Ключевые паттерны

**Регистрация маршрутов**: Модули экспортируют функцию, которая получает `FastifyInstance` и регистрирует маршруты. В `app.ts` маршруты монтируются с префиксами под `/api/v1`.

**Аутентификация**: Admin-маршруты используют `guard = { onRequest: [app.authenticate] }`. Customer-маршруты имеют свою JWT-логику. Публичные маршруты без аутентификации.

**Валидация**: Все тела запросов и query-строки валидируются Zod схемами из `src/shared/types.ts`. Паттерн: parse → safeParse → `badRequest` при ошибке.

**Обработка ошибок**: Глобальный хендлер в `app.ts` (`app.setErrorHandler`). Используйте хелперы из `shared/errors.ts` для консистентного JSON ответа: `{ error: 'ERROR_CODE', message }`.

**Доступ к Prisma**: После регистрации `prismaPlugin` используйте `app.prisma` в любом месте маршрутов. Это синглтон (один инстанс PrismaClient).

**Многоязычные поля**: В БД используются суффиксы `Tk` (туркменский) и `Ru` (русский). API возвращает оба варианта; клиент выбирает по локали.

**Опции товаров**: `Product.options` — JSON (массив). `OrderLine.options` — JSON (объект) хранит выбранные клиентом опции.

**Загрузка файлов**: Использует `@fastify/multipart` с лимитом 5MB, 1 файл. Плагин Cloudinary обрабатывает загрузки.

### Организация API

Все маршруты смонтированы под `/api/v1` с префиксами модулей:
- `/api/v1/auth` — Логин/refresh/profile админа
- `/api/v1/customer` — Регистрация/логин клиента
- `/api/v1/products` — Публичный листинг + админ CRUD; `/categories/all`
- `/api/v1/orders` — CRUD заказов + аналитика
- `/api/v1/customers` — Управление клиентами
- `/api/v1/dashboard` — Сводная статистика
- `/api/v1/analytics` — Отчеты по диапазону дат
- `/api/v1/settings` — Настройки магазина, обновление аккаунта, смена пароля
- `/api/v1/upload` — Загрузка изображений
- `/api/v1/requests` — Запросы товаров
- `/api/v1/products/:id/comments` — Вложено в products

**Документация**: Swagger UI на `/docs`. Health check на `/health`.

### Конфигурация

Из `src/config.ts` и переменных окружения:
- `PORT` (default: 3001), `HOST` (default: 0.0.0.0)
- `NODE_ENV` — задает флаг `isDev`; в dev используется `pino-pretty` логгер
- `CORS_ORIGINS` — список разрешенных origins через запятую
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` — обязательные
- `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES` — дефолты: 15m / 7d
- `DATABASE_URL` — обязательное подключение к PostgreSQL
- Cloudinary переменные: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

## Работа с кодом

### Добавление нового модуля/маршрутов

1. Создать `src/modules/<feature>/<feature>.routes.ts`
2. Экспортировать default async функцию `(app: FastifyInstance) => { ... }`
3. Зарегистрировать в `app.ts` (и импорт, и `api.register()` под `/api/v1`)
4. Добавить Zod схемы в `src/shared/types.ts` при необходимости
5. Использовать хелперы ошибок из `shared/errors.ts` для консистентных ответов

### Изменения в базе данных

1. Редактировать `prisma/schema.prisma`
2. Запустить `pnpm db:push` (dev) или `pnpm db:migrate` (создает файл миграции)
3. Типы генерируются автоматически; перезапустить dev-сервер для подхватывания изменений

### Тестирование

Фреймворк тестов не настроен. Если добавляете тесты:
- Рассмотрите Vitest или Jest
- Размещайте тесты рядом с модулями или в папках `__tests__/`
- Используйте `tsx` для запуска тестовых скриптов или настройте test runner

### TypeScript

- ESM (`"type": "module"`), `moduleResolution: NodeNext`
- Выход в `dist/` (в .gitignore)
- Для dev используйте `tsx` (нативная ESM поддержка)
- Импорты используют расширения файлов (`.js` для TypeScript файлов из-за NodeNext)

## Примечания

- Проект использует `fastify-plugin` для правильной инкапсуляции плагинов (prisma, jwt, cloudinary).
- Admin auth использует декоратор `app.authenticate`; customer auth inline в маршрутах.
- Admin JWT payload типизирован через generic Fastify; customer JWT использует декoration `req.customer` (смотрите модуль custumer-auth).
- Все поля decimal в Prisma используют `@db.Decimal(10, 2)`.
- Поиск товаров использует case-insensitive `contains` по обоим временным полям.
