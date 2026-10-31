# CamiloShop

E-commerce de portafolio con estilo lujoso y urbano: tecnología, cosméticos y ropa. Construido con Next.js 16 (App Router), TypeScript estricto, Tailwind CSS v4, Supabase, Prisma y Cloudflare Workers (OpenNext).

> **Estado:** fase 1 de 7 (base, diseño y spike de infraestructura). La home usa datos de ejemplo; el catálogo real llega en la fase 2a.
> Los pagos funcionarán en **modo sandbox**: no se cobra dinero real.

## Stack

| Capa           | Tecnología                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19 + TypeScript 6 (strict)                          |
| Estilos        | Tailwind CSS v4 (solo utilidades; `src/app/globals.css` contiene únicamente tokens) |
| i18n           | next-intl: español (`/es`, principal) e inglés (`/en`)                              |
| Estado global  | Zustand (moneda; carrito y vistos recientemente en fases siguientes)                |
| Base de datos  | Supabase Postgres + Prisma 7 (`@prisma/adapter-pg`) vía Cloudflare Hyperdrive       |
| Auth / Storage | Supabase Auth y Storage (fase 3 y 6)                                                |
| Despliegue     | Cloudflare Workers con `@opennextjs/cloudflare`                                     |
| Tests          | Vitest (unitarios); Playwright y CI llegan en la fase 7b                            |

Las decisiones técnicas del spike (ORM, tamaño del Worker, middleware) están en [docs/decisions.md](docs/decisions.md).

## Requisitos

- Node.js 22.12 o superior (probado con Node 24).
- npm (viene con Node).
- Cuenta de Cloudflare y proyecto de Supabase, para el deploy y la base de datos.

## Puesta en marcha local

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Abre http://localhost:3000; te redirige a `/es`.

> `npm install` ejecuta `prisma generate` automáticamente.
> Aunque todavía no tengas base de datos, `.env.local` debe tener un valor en `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` (puede ser el de ejemplo); sin él, wrangler no deja arrancar `next dev` ni `next build`.

## Scripts

| Script               | Qué hace                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Servidor de desarrollo (Turbopack)                                |
| `npm run build`      | Build de producción de Next.js (webpack; ver `docs/decisions.md`) |
| `npm run lint`       | ESLint                                                            |
| `npm run typecheck`  | TypeScript sin emitir archivos                                    |
| `npm test`           | Tests unitarios con Vitest                                        |
| `npm run format`     | Prettier (ordena las clases de Tailwind)                          |
| `npm run cf:build`   | Build de OpenNext para Cloudflare                                 |
| `npm run cf:size`    | Deploy en seco: muestra el tamaño comprimido del Worker           |
| `npm run preview`    | Build de OpenNext y Worker local en workerd                       |
| `npm run deploy`     | Build y deploy a Cloudflare                                       |
| `npm run cf-typegen` | Regenera `cloudflare-env.d.ts` desde `wrangler.jsonc`             |

## Configurar Supabase y Cloudflare (fase 1)

1. **Supabase:** crea un proyecto (región `sa-east-1`, São Paulo). En _Connect → Connection string_ copia la URL del **Session pooler (puerto 5432)** y pégala en `.env.local` como `DATABASE_URL`, `DIRECT_URL` y `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`. En _Project Settings → API_ copia la URL, la anon key y la service role key.
2. **Cloudflare:** inicia sesión con wrangler:

   ```bash
   npx wrangler login
   ```

3. Crea el Hyperdrive con la URL del session pooler:

   ```bash
   npx wrangler hyperdrive create camiloshop-db --connection-string="postgresql://..."
   ```

   Copia el `id` que devuelve y reemplaza `00000000000000000000000000000000` en `wrangler.jsonc`.

4. Crea la tabla del spike:

   ```bash
   npm run db:push
   ```

5. Comprueba la conexión en local: `npm run dev` y abre http://localhost:3000/api/health. Debe responder `{"status":"ok","db":"ok",...}`.
6. Despliega:

   ```bash
   npm run deploy
   ```

   Abre `https://camiloshop.<tu-subdominio>.workers.dev/api/health`.

> **Windows:** OpenNext advierte que Windows no está soportado del todo. El build funciona con webpack; si aparece algún error de symlinks, usa WSL o activa el Modo de Desarrollador de Windows.

## Diseño

- Paleta: fondo `#0b0f19`, violeta `#7c3aed` (botones y cabeceras), cyan `#22d3ee` y rosa `#f472b6` (acentos), claro `#f8fafc`.
- Cada módulo de la página tiene **un solo neón dominante** (por ejemplo, héroe en violeta, categorías en cyan, promo en rosa).
- Modo oscuro por defecto, con modo claro opcional. Los colores de acento usados como texto tienen versiones ajustadas por tema para cumplir WCAG AA.
- Tipografías: Sora (títulos) e Inter (texto).
- Accesibilidad: enlace "saltar al contenido", foco visible en todos los controles, ARIA en menús y formularios, y `prefers-reduced-motion` respetado.

## Estructura

```
src/
  app/              rutas (App Router); [locale]/ contiene la tienda
  components/ui     componentes base (Button, Badge, Skeleton…)
  components/layout Header, Footer, selectores de idioma/moneda/tema
  config/           árbol de categorías (estático en la fase 1)
  features/         código por dominio (catalog, cart, checkout…)
  i18n/             configuración de next-intl
  lib/              utilidades (db, env, money, supabase)
  stores/           stores de Zustand
messages/           textos en es.json y en.json
prisma/             esquema de base de datos
docs/               decisiones técnicas
```

## Limitaciones conocidas

- **Emails:** sin dominio propio, Resend envía con `onboarding@resend.dev` y **solo entrega al correo del dueño de la cuenta**. Por eso, el camino principal para visitantes será el botón **"Entrar como demo"** (fase 3). Verificar un dominio propio queda como mejora futura.
- **Supabase Free pausa el proyecto** tras unos días sin actividad. Para reactivarlo: entra a supabase.com, abre el proyecto y pulsa _Restore project_. En la fase 7b se agrega un workflow que hace ping a `/api/health` cada 3 días para evitarlo.

## Aviso

Proyecto de portafolio. Las marcas de productos son ficticias, los pagos funcionan en sandbox y los comprobantes generados **no son facturas electrónicas DIAN**.
