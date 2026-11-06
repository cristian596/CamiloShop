# CamiloShop

E-commerce de portafolio con estilo lujoso y urbano: tecnología, cosméticos y ropa. Construido con Next.js 16 (App Router), TypeScript estricto, Tailwind CSS v4, Supabase, Prisma y Cloudflare Workers (OpenNext).

> **Estado:** fase 3 de 7 (catálogo completo y cuentas de usuario: registro, ingreso con correo o Google, recuperación de contraseña, perfil, direcciones, favoritos y páginas legales). El carrito y el checkout llegan en la fase 4.

## Probar la tienda como visitante

En `/es/login` pulsa **"Entrar como demo"**: inicia sesión con una cuenta de cliente compartida, sin registrarte. Es el camino recomendado porque, sin dominio propio, los correos de verificación y bienvenida solo llegan al dueño de la cuenta de Resend (ver _Limitaciones conocidas_). La cuenta demo no puede cambiar su contraseña. El administrador de demo no es público.

> Los pagos funcionarán en **modo sandbox**: no se cobra dinero real.

## Stack

| Capa           | Tecnología                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19 + TypeScript 6 (strict)                          |
| Estilos        | Tailwind CSS v4 (solo utilidades; `src/app/globals.css` contiene únicamente tokens) |
| i18n           | next-intl: español (`/es`, principal) e inglés (`/en`)                              |
| Estado global  | Zustand (moneda y vistos recientemente; el carrito llega en la fase 4)              |
| Base de datos  | Supabase Postgres + Prisma 7 (`@prisma/adapter-pg`) vía Cloudflare Hyperdrive       |
| Auth / Storage | Supabase Auth (correo y Google) y Storage (fase 6)                                  |
| Emails         | API de Resend (bienvenida; pedidos en las fases 4 y 5)                              |
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
| `npm run db:migrate` | Aplica las migraciones pendientes (`prisma migrate deploy`)       |
| `npm run db:seed`    | Carga o actualiza el catálogo de ejemplo (idempotente)            |
| `npm run db:diff`    | Muestra el SQL necesario para llevar la base al esquema actual    |
| `npm run db:status`  | Estado de las migraciones                                         |
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

4. Crea las tablas y carga el catálogo de ejemplo:

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

5. Comprueba la conexión en local: `npm run dev` y abre http://localhost:3000/api/health. Debe responder `{"status":"ok","db":"ok",...}`.
6. Despliega. El CLI de OpenNext no lee `.env.local`, así que primero exporta la variable de Hyperdrive en la terminal (Git Bash):

   ```bash
   export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="$(grep -E '^CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=' .env.local | cut -d= -f2- | tr -d '"')"
   ```

   Compila con la URL pública para que el canonical y Open Graph no apunten a localhost:

   ```bash
   NEXT_PUBLIC_SITE_URL=https://camiloshop.<tu-subdominio>.workers.dev npm run deploy
   ```

   Abre `https://camiloshop.<tu-subdominio>.workers.dev/api/health`.

> `NEXT_PUBLIC_SUPABASE_URL` debe ser la URL base del proyecto (`https://<ref>.supabase.co`), sin `/rest/v1`.

## Configurar la autenticación (fase 3)

1. **Variables** en `.env.local` (ver `.env.example`): `REQUIRE_EMAIL_VERIFICATION`, `RATE_LIMIT_SALT`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `RESEND_API_KEY` y `EMAIL_FROM`. Copia las mismas variables de servidor en `.dev.vars` para `npm run preview`.
2. **Migraciones y usuario demo:** `npm run db:migrate` crea el trigger que genera el perfil de cada usuario nuevo y el hook de rol; `npm run db:seed` crea (o restablece) la cuenta demo con una dirección.
3. **Supabase → Authentication → URL Configuration:** _Site URL_ = la URL pública del Worker. En _Redirect URLs_ agrega `http://localhost:3000/auth/callback` y `https://camiloshop.<tu-subdominio>.workers.dev/auth/callback`.
4. **Supabase → Authentication → Hooks:** activa _Customize Access Token (JWT) Claims_ y elige la función `public.custom_access_token_hook`. Agrega `app_metadata.user_role` (`admin` o `customer`) al token.
5. **Google:** en Google Cloud Console crea un cliente OAuth (tipo _Web application_) con la URI de redirección que muestra Supabase en _Authentication → Sign In / Providers → Google_ (`https://<ref>.supabase.co/auth/v1/callback`). Pega el Client ID y el Secret en Supabase. Luego, en _OAuth consent screen_, pulsa **Publish app** para pasarla de _Testing_ a _In production_; si no, solo entran las cuentas de prueba.
6. **Resend:** crea una API key y ponla en `RESEND_API_KEY`. Para que Supabase envíe la verificación y la recuperación por Resend, en _Authentication → Emails → SMTP Settings_ usa host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key y remitente `onboarding@resend.dev`.
7. **Producción:** los secretos van con wrangler (una vez por variable):

   ```bash
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

   Repite con `RATE_LIMIT_SALT`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `RESEND_API_KEY`, `EMAIL_FROM` y `REQUIRE_EMAIL_VERIFICATION`.

8. **Promover tu usuario a admin** (en el SQL Editor de Supabase, con tu correo):

   ```sql
   update "Profile" set role = 'ADMIN' where email = 'tu-correo@ejemplo.com';
   ```

   Cierra sesión y vuelve a entrar para que el token traiga el rol nuevo; luego abre `/es/admin`.

**Rol en el JWT:** el claim `user_role` solo se actualiza cuando el token se renueva (cada hora por defecto) o al volver a iniciar sesión. El middleware usa ese claim solo para redirigir; la autorización real (`requireAdmin()`) siempre lee `Profile.role` en la base de datos, así que un rol revocado deja de servir de inmediato aunque el token diga otra cosa. En la fase 6, cambiar un rol desde el admin también cerrará las sesiones de ese usuario.

**Verificación de correo:** con `REQUIRE_EMAIL_VERIFICATION=false` el registro crea la cuenta ya confirmada (Admin API de Supabase) e inicia sesión de una vez; ese camino tiene un límite de 5 registros por hora por IP. Con `true`, Supabase envía un enlace de confirmación que vuelve a `/auth/callback`.

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
  config/           categorías, catálogo, departamentos, versión legal
  features/         código por dominio (catalog, auth, account, legal…)
  i18n/             configuración de next-intl
  lib/              utilidades (db, env, auth, rate-limit, email, supabase)
  stores/           stores de Zustand
messages/           textos en es.json y en.json
prisma/             esquema de base de datos
docs/               decisiones técnicas
```

## Limitaciones conocidas

- **Emails:** sin dominio propio, Resend envía con `onboarding@resend.dev` y **solo entrega al correo del dueño de la cuenta**. Por eso, el camino principal para visitantes es el botón **"Entrar como demo"**. Un envío fallido se registra en los logs y nunca interrumpe el registro ni los pedidos. Verificar un dominio propio queda como mejora futura.
- **Páginas legales:** términos, tratamiento de datos (Ley 1581) y devoluciones son **plantillas** y deben revisarlas un abogado antes de usarlas en un comercio real.
- **Supabase Free pausa el proyecto** tras unos días sin actividad. Para reactivarlo: entra a supabase.com, abre el proyecto y pulsa _Restore project_. En la fase 7b se agrega un workflow que hace ping a `/api/health` cada 3 días para evitarlo.

## Aviso

Proyecto de portafolio. Las marcas de productos son ficticias, los pagos funcionan en sandbox y los comprobantes generados **no son facturas electrónicas DIAN**.
