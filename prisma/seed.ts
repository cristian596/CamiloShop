/**
 * Seeds the catalog and store settings. Idempotent: rows are upserted by their
 * natural keys (slug, sku, code, city), so it is safe to run more than once.
 *
 * Run with: npm run db:seed
 */
import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { COLORS } from "../src/config/catalog";
import { LEGAL_VERSION } from "../src/config/legal";
import { ROOT_CATEGORIES } from "../src/config/categories";
import en from "../messages/en.json";
import es from "../messages/es.json";
import { BRANDS, PRODUCTS, SHIPPING_RATES, type SeedProduct } from "./seed-data/products";

config({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL;
if (!connectionString) throw new Error("DIRECT_URL is required to seed the database");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const DAY_MS = 24 * 60 * 60 * 1000;

function unsplashUrl(photoId: string): string {
  // Size and format params are added at render time by the image loader.
  return `https://images.unsplash.com/photo-${photoId}`;
}

function skuPart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase();
}

/** Deterministic stock so the catalog looks the same after every seed. */
function stockFor(productIndex: number, variantIndex: number): number {
  const value = (productIndex * 7 + variantIndex * 5) % 23;
  // A few variants are sold out on purpose to exercise the UI.
  return value < 2 ? 0 : value + 2;
}

function buildVariants(product: SeedProduct, productIndex: number) {
  const sizes = product.sizes?.length ? product.sizes : [null];
  const colors = product.colors?.length ? product.colors : [null];
  const base = `CS-${String(productIndex + 1).padStart(3, "0")}`;

  return sizes.flatMap((size, sizeIndex) =>
    colors.map((color, colorIndex) => {
      const variantIndex = sizeIndex * colors.length + colorIndex;
      const sku = [base, size && skuPart(size), color && skuPart(color)].filter(Boolean).join("-");
      return {
        sku,
        size,
        color,
        colorHex: color ? COLORS[color] : null,
        priceOverride: size ? (product.priceBySize?.[size] ?? null) : null,
        stock: stockFor(productIndex, variantIndex),
      };
    }),
  );
}

async function seedSettings() {
  const settings = [
    { key: "usdRate", value: 4000 },
    { key: "freeShippingThreshold", value: 200_000 },
    { key: "taxRate", value: 0.19 },
  ];
  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }
}

async function seedCoupons() {
  const coupons = [
    { code: "CLAUDE10", type: "PERCENT" as const, value: 10 },
    { code: "GEMINI5", type: "PERCENT" as const, value: 5 },
  ];
  for (const coupon of coupons) {
    await prisma.coupon.upsert({ where: { code: coupon.code }, update: {}, create: coupon });
  }
}

async function seedShippingRates() {
  for (const rate of SHIPPING_RATES) {
    await prisma.shippingRate.upsert({
      where: { city: rate.city },
      update: { department: rate.department, price: rate.price, etaDays: rate.etaDays },
      create: rate,
    });
  }
}

async function seedCategories(): Promise<Map<string, string>> {
  const idsBySlug = new Map<string, string>();

  for (const [rootIndex, root] of ROOT_CATEGORIES.entries()) {
    const parent = await prisma.category.upsert({
      where: { slug: root.slug },
      update: {
        nameEs: es.Categories[root.key],
        nameEn: en.Categories[root.key],
        position: rootIndex,
      },
      create: {
        slug: root.slug,
        nameEs: es.Categories[root.key],
        nameEn: en.Categories[root.key],
        position: rootIndex,
      },
    });
    idsBySlug.set(root.slug, parent.id);

    for (const [childIndex, child] of root.children.entries()) {
      const data = {
        nameEs: es.Categories[child.key],
        nameEn: en.Categories[child.key],
        position: childIndex,
        parentId: parent.id,
      };
      const category = await prisma.category.upsert({
        where: { slug: child.slug },
        update: data,
        create: { slug: child.slug, ...data },
      });
      idsBySlug.set(child.slug, category.id);
    }
  }

  return idsBySlug;
}

async function seedBrands(): Promise<Map<string, string>> {
  const idsBySlug = new Map<string, string>();
  for (const brand of BRANDS) {
    const row = await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: { name: brand.name },
      create: brand,
    });
    idsBySlug.set(brand.slug, row.id);
  }
  return idsBySlug;
}

async function seedProducts(categoryIds: Map<string, string>, brandIds: Map<string, string>) {
  const now = Date.now();

  for (const [index, product] of PRODUCTS.entries()) {
    const categoryId = categoryIds.get(product.category);
    const brandId = brandIds.get(product.brand);
    if (!categoryId || !brandId) {
      throw new Error(`Unknown category or brand for product ${product.slug}`);
    }

    const data = {
      nameEs: product.nameEs,
      nameEn: product.nameEn,
      descriptionEs: product.descriptionEs,
      descriptionEn: product.descriptionEn,
      categoryId,
      brandId,
      price: product.price,
      compareAtPrice: product.compareAtPrice ?? null,
      isFeatured: product.isFeatured ?? false,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      soldCount: product.soldCount,
    };

    const row = await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      // Spread creation dates so "newest" sorting and the "New" badge have something to show.
      create: { slug: product.slug, ...data, createdAt: new Date(now - index * 2 * DAY_MS) },
    });

    // Seeded images are external (no storagePath); admin uploads are left untouched.
    await prisma.productImage.deleteMany({ where: { productId: row.id, storagePath: null } });
    await prisma.productImage.create({
      data: {
        productId: row.id,
        url: unsplashUrl(product.image),
        altEs: product.nameEs,
        altEn: product.nameEn,
        position: 0,
      },
    });

    for (const variant of buildVariants(product, index)) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: { ...variant, productId: row.id },
        create: { ...variant, productId: row.id },
      });
    }
  }
}

/**
 * Creates (or resets) the shared demo customer used by "Entrar como demo".
 * Skipped unless DEMO_USER_EMAIL, DEMO_USER_PASSWORD and the service role key are set.
 * The profile row itself is created by the on_auth_user_created trigger.
 */
async function seedDemoUser() {
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!email || !password || !url || !serviceKey) {
    console.log("Demo user skipped (DEMO_USER_* or Supabase service role not configured).");
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const metadata = { full_name: "Cliente Demo", locale: "es", privacy_version: LEGAL_VERSION };

  const existing = await prisma.profile.findUnique({ where: { email }, select: { id: true } });
  let userId = existing?.id;
  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const now = new Date();
  await prisma.profile.update({
    where: { id: userId },
    data: {
      fullName: "Cliente Demo",
      phone: "3001234567",
      role: "CUSTOMER",
      isActive: true,
      privacyAcceptedAt: now,
      privacyVersion: LEGAL_VERSION,
      // The demo inbox does not exist: never send it a welcome email.
      welcomeEmailSentAt: now,
    },
  });

  // Read by public.reset_demo_data() (pg_cron, daily).
  await prisma.setting.upsert({
    where: { key: "demoUserEmail" },
    update: { value: email },
    create: { key: "demoUserEmail", value: email },
  });

  await prisma.address.deleteMany({ where: { userId } });
  await prisma.address.create({
    data: {
      userId,
      label: "Casa",
      recipient: "Cliente Demo",
      phone: "3001234567",
      department: "Antioquia",
      city: "Medellín",
      line1: "Calle 10 # 43-21",
      line2: "Apto 502, El Poblado",
      isDefault: true,
    },
  });
  console.log("Demo user ready.");
}

async function main() {
  await seedSettings();
  await seedCoupons();
  await seedShippingRates();
  const categoryIds = await seedCategories();
  const brandIds = await seedBrands();
  await seedProducts(categoryIds, brandIds);
  await seedDemoUser();

  const [products, variants] = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);
  console.log(`Seed complete: ${products} products, ${variants} variants.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
