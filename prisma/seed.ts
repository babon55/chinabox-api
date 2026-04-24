import { PrismaClient, ProductStatus, CustomerStatus, OrderStatus } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

function hashPw(pw: string) {
  return bcrypt.hashSync(pw, 10)  // ← use this
}

async function main() {
  console.log('🌱  Seeding database…')

  // ── Admin user ─────────────────────────────────────────────────────────────
 await prisma.user.upsert({
  where:  { email: 'admin@silkshop.tm' },
  update: { passwordHash: hashPw('admin123') },  // ← add this
  create: {
    name:         'Admin',
    email:        'admin@silkshop.tm',
    passwordHash: hashPw('admin123'),
    role:         'ADMIN',
    avatar:       '👨‍💼',
  },
})
  console.log('  ✓ Admin user')

  // ── Store settings ─────────────────────────────────────────────────────────
  await prisma.storeSettings.upsert({
    where:  { id: 'singleton' },
    update: {},
    create: { id: 'singleton' },
  })
  console.log('  ✓ Store settings')

  // ── Categories ─────────────────────────────────────────────────────────────
  const cats = await Promise.all([
    prisma.category.upsert({ where: { id: 'cat-1' }, update: {}, create: { id: 'cat-1', nameTk: 'Elektronika', nameRu: 'Электроника' } }),
    prisma.category.upsert({ where: { id: 'cat-2' }, update: {}, create: { id: 'cat-2', nameTk: 'Aksesuar',    nameRu: 'Аксессуары'  } }),
    prisma.category.upsert({ where: { id: 'cat-3' }, update: { nameTk: 'Egin-eşik', nameRu: 'Одежда' }, create: { id: 'cat-3', nameTk: 'Egin-eşik',  nameRu: 'Одежда'      } }),
    prisma.category.upsert({ where: { id: 'cat-4' }, update: {}, create: { id: 'cat-4', nameTk: 'Gözellik',   nameRu: 'Красота'     } }),
    prisma.category.upsert({ where: { id: 'cat-5' }, update: {}, create: { id: 'cat-5', nameTk: 'Öý üçin',   nameRu: 'Для дома'    } }),
  ])
  console.log('  ✓ Categories')

  // ── Products ───────────────────────────────────────────────────────────────
  const products = await Promise.all([
    prisma.product.upsert({ where: { id: 'prd-001' }, update: {}, create: { id: 'prd-001', nameTk: 'Simsiz Gulaklyk Pro',    nameRu: 'Наушники Pro',            categoryId: cats[0].id, image: '🎧', price: 24.99, stock: 42,  sold: 284, status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-002' }, update: {}, create: { id: 'prd-002', nameTk: 'Akylly Sagat Series 3',  nameRu: 'Умные часы Series 3',     categoryId: cats[0].id, image: '⌚', price: 89.99, stock: 18,  sold: 173, status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-003' }, update: {}, create: { id: 'prd-003', nameTk: 'Göçme Zarýadlaýjy',     nameRu: 'Портативная зарядка',     categoryId: cats[1].id, image: '🔋', price: 12.99, stock: 105, sold: 461, status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-004' }, update: {}, create: { id: 'prd-004', nameTk: 'Bluetooth Dinamigi',    nameRu: 'Bluetooth-колонка',       categoryId: cats[0].id, image: '🔊', price: 24.99, stock: 67,  sold: 198, status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-005' }, update: {}, create: { id: 'prd-005', nameTk: 'Kamera Çantasy',        nameRu: 'Сумка для камеры',        categoryId: cats[2].id, image: '🎒', price: 18.50, stock: 89,  sold: 134, status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-006' }, update: {}, create: { id: 'prd-006', nameTk: 'Akylly Lampochka',      nameRu: 'Умная лампочка',          categoryId: cats[4].id, image: '💡', price: 9.99,  stock: 8,   sold: 92,  status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-007' }, update: {}, create: { id: 'prd-007', nameTk: 'USB-C Hub 7-in-1',      nameRu: 'USB-C Hub 7-в-1',         categoryId: cats[1].id, image: '🔌', price: 34.99, stock: 0,   sold: 57,  status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-008' }, update: {}, create: { id: 'prd-008', nameTk: 'Sport Köwüş Nike',      nameRu: 'Кроссовки Nike',          categoryId: cats[2].id, image: '👟', price: 79.99, stock: 34,  sold: 210, status: ProductStatus.DRAFT    } }),
    prisma.product.upsert({ where: { id: 'prd-009' }, update: {}, create: { id: 'prd-009', nameTk: 'Ýüz Kremi',             nameRu: 'Крем для лица',           categoryId: cats[3].id, image: '🧴', price: 15.00, stock: 55,  sold: 88,  status: ProductStatus.ACTIVE   } }),
    prisma.product.upsert({ where: { id: 'prd-010' }, update: {}, create: { id: 'prd-010', nameTk: 'Mehaniki Klawiatura',   nameRu: 'Механическая клавиатура', categoryId: cats[0].id, image: '⌨️', price: 59.99, stock: 5,   sold: 41,  status: ProductStatus.ARCHIVED } }),
  ])
  console.log('  ✓ Products')

  // ── Customers ──────────────────────────────────────────────────────────────
  const customers = await Promise.all([
    prisma.customer.upsert({ where: { email: 'merdan@mail.com'   }, update: {}, create: { id: 'cst-001', name: 'Merdan Ataýew',      email: 'merdan@mail.com',   phone: '+993 65 123456', address: 'Aşgabat, Bitarap Türkmenistan köç. 12', status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'ayna@mail.com'     }, update: {}, create: { id: 'cst-002', name: 'Aýna Durdyýewa',    email: 'ayna@mail.com',     phone: '+993 62 654321', address: 'Aşgabat, Görogly köç. 44',              status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'serdar@mail.com'   }, update: {}, create: { id: 'cst-003', name: 'Serdar Nurýew',     email: 'serdar@mail.com',   phone: '+993 61 987654', address: 'Mary, Mollanepes köç. 7',               status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'guljeren@mail.com' }, update: {}, create: { id: 'cst-004', name: 'Güljeren Orazowa',  email: 'guljeren@mail.com', phone: '+993 63 112233', address: 'Türkmenabat, Magtymguly köç. 3',        status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'dowlet@mail.com'   }, update: {}, create: { id: 'cst-005', name: 'Döwlet Hojamow',    email: 'dowlet@mail.com',   phone: '+993 64 445566', address: 'Balkanabat, Ruhy köç. 18',              status: CustomerStatus.BLOCKED } }),
    prisma.customer.upsert({ where: { email: 'orazgul@mail.com'  }, update: {}, create: { id: 'cst-006', name: 'Orazgül Annaýewa', email: 'orazgul@mail.com',  phone: '+993 65 778899', address: 'Aşgabat, Andalyp köç. 56',              status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'bayram@mail.com'   }, update: {}, create: { id: 'cst-007', name: 'Baýram Myradow',    email: 'bayram@mail.com',   phone: '+993 62 334455', address: 'Daşoguz, Nurmuhammet Andalyp köç. 2',  status: CustomerStatus.ACTIVE  } }),
    prisma.customer.upsert({ where: { email: 'maral@mail.com'    }, update: {}, create: { id: 'cst-008', name: 'Maral Halmyradowa', email: 'maral@mail.com',    phone: '+993 61 667788', address: 'Aşgabat, Oguzhan köç. 9',               status: CustomerStatus.ACTIVE  } }),
  ])
  console.log('  ✓ Customers')

  // ── Orders + Lines ─────────────────────────────────────────────────────────
  const ordersData = [
    { id: 'ord-001', customerId: customers[0].id, status: OrderStatus.DELIVERED,  total: 50.97,  note: null,
      lines: [{ productId: products[0].id, qty: 1, unitPrice: 24.99 }, { productId: products[2].id, qty: 2, unitPrice: 12.99 }] },
    { id: 'ord-002', customerId: customers[1].id, status: OrderStatus.SHIPPED,    total: 89.99,  note: 'Sowgat bukjasy bilen iberilmegini haýyş edýärin.',
      lines: [{ productId: products[1].id, qty: 1, unitPrice: 89.99 }] },
    { id: 'ord-003', customerId: customers[2].id, status: OrderStatus.PROCESSING, total: 113.48, note: null,
      lines: [{ productId: products[3].id, qty: 2, unitPrice: 24.99 }, { productId: products[4].id, qty: 1, unitPrice: 18.50 }, { productId: products[8].id, qty: 3, unitPrice: 15.00 }] },
    { id: 'ord-004', customerId: customers[3].id, status: OrderStatus.PENDING,    total: 24.97,  note: null,
      lines: [{ productId: products[5].id, qty: 2, unitPrice: 9.99 }] },
    { id: 'ord-005', customerId: customers[4].id, status: OrderStatus.CANCELLED,  total: 99.97,  note: 'Müşderi yzyna gaýtarma talap etdi.',
      lines: [{ productId: products[6].id, qty: 1, unitPrice: 34.99 }, { productId: products[9].id, qty: 1, unitPrice: 59.99 }] },
    { id: 'ord-006', customerId: customers[5].id, status: OrderStatus.PENDING,    total: 84.98,  note: null,
      lines: [{ productId: products[7].id, qty: 1, unitPrice: 79.99 }] },
    { id: 'ord-007', customerId: customers[6].id, status: OrderStatus.SHIPPED,    total: 79.96,  note: null,
      lines: [{ productId: products[0].id, qty: 2, unitPrice: 24.99 }, { productId: products[3].id, qty: 1, unitPrice: 24.99 }] },
  ]

  for (const o of ordersData) {
    await prisma.order.upsert({
      where:  { id: o.id },
      update: {},
      create: {
        id:         o.id,
        customerId: o.customerId,
        status:     o.status,
        total:      o.total,
        note:       o.note,
        lines:      { create: o.lines },
      },
    })
  }
  console.log('  ✓ Orders + lines')
  console.log('\n✅  Seed complete!')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())