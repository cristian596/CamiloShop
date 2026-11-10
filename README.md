# CamiloShop

E-commerce de portafolio con estilo lujoso y urbano: tecnología, cosméticos y ropa. Construido con Next.js 16 (App Router), TypeScript estricto, Tailwind CSS v4, Supabase, Prisma y Vercel.

> **Estado:** fase 5 de 7 (catálogo, cuentas, carrito, checkout, pagos con tarjeta y PSE (integración Wompi + pasarela simulada para la demo), contra entrega, pedidos y comprobante PDF). El panel de administración llega en la fase 6.

## Probar la tienda como visitante

En `/es/login` pulsa **"Entrar como demo"**: inicia sesión con una cuenta de cliente compartida, sin registrarte. Es el camino recomendado porque, sin dominio propio, los correos de verificación y bienvenida solo llegan al dueño de la cuenta de Resend (ver _Limitaciones conocidas_). La cuenta demo no puede cambiar su contraseña. El administrador de demo no es público.

Para probar una compra: agrega productos al carrito, ve a pagar, aplica el cupón `CLAUDE10` (10 %) o `GEMINI5` (5 %), elige **pago contra entrega** y confirma. El pedido queda **pendiente**; puedes descargar el comprobante en PDF o cancelarlo desde _Mi cuenta → Pedidos_. Los pedidos pendientes de la cuenta demo se cancelan solos cada día.

> Los pagos funcionarán en **modo sandbox**: no se cobra dinero real.

## Stack

| Capa           | Tecnología                                                                          |
| -------------- | ----------------------------------------------------------------------------------- |
| Framework      | Next.js 16 (App Router) + React 19 + TypeScript 6 (strict)                          |
| Estilos        | Tailwind CSS v4 (solo utilidades; `src/app/globals.css` contiene únicamente tokens) |
| i18n           | next-intl: español (`/es`, principal) e inglés (`/en`)                              |
| Estado global  | Zustand (carrito, moneda y vistos recientemente, guardados en el navegador)         |
| Base de datos  | Supabase Postgres + Prisma 7 (`@prisma/adapter-pg`) vía el pooler de Supabase       |
| Auth / Storage | Supabase Auth (correo y Google) y Storage (fase 6)                                  |
| Emails         | API de Resend (bienvenida; pedidos en las fases 4 y 5)                              |
| Despliegue     | Vercel (plan Hobby, Fluid compute)                                                  |
| Tests          | Vitest (unitarios); Playwright y CI llegan en la fase 7b                            |

Las decisiones técnicas (ORM, hosting, proxy, pagos) están en [docs/decisions.md](docs/decisions.md). El proyecto empezó en Cloudflare Workers y se migró a Vercel; el porqué también está ahí.

## Requisitos

- Node.js 22.12 o superior (probado con Node 24).
- npm (viene con Node).
- Proyecto de Supabase (base de datos y auth) y cuenta de Vercel (deploy).

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

## Configurar Supabase

1. Crea un proyecto en Supabase. En _Connect → Connection string_ copia dos URLs y pégalas en `.env.local`:
   - **Transaction pooler (puerto 6543)** como `DATABASE_URL`. Es la que usa la app en local y en Vercel.
   - **Session pooler (puerto 5432)** como `DIRECT_URL`. La usan las migraciones, el seed y los tests de integración.

   En _Project Settings → API_ copia la URL, la anon key y la service role key.

2. Crea las tablas y carga el catálogo de ejemplo:

   ```bash
   npm run db:migrate
   ```

   ```bash
   npm run db:seed
   ```

3. Comprueba la conexión: `npm run dev` y abre http://localhost:3000/api/health. Debe responder `{"status":"ok","db":"ok",...}`.

> `NEXT_PUBLIC_SUPABASE_URL` debe ser la URL base del proyecto (`https://<ref>.supabase.co`), sin `/rest/v1`.

## Desplegar en Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com) (plan **Hobby**, gratis).
2. Inicia sesión y enlaza la carpeta con un proyecto nuevo (`camiloshop`):

   ```bash
   npx vercel login
   ```

   ```bash
   npx vercel link
   ```

3. **Variables de entorno.** En el proyecto, ve a _Settings → Environment Variables_. Pega el contenido de `.env.local` (el formulario acepta un `.env` completo) y márcalas para _Production_. Luego ajusta dos:
   - `NEXT_PUBLIC_SITE_URL`: la URL pública, por ejemplo `https://camiloshop.vercel.app`.
   - `DATABASE_URL`: la del **transaction pooler (6543)**.

   Las variables `NEXT_PUBLIC_*` se incrustan al compilar, así que cualquier cambio necesita un deploy nuevo.

4. **Región.** `vercel.json` fija las funciones en `pdx1` (Portland, Oregón), junto al proyecto de Supabase en `us-west-2`. Si tu proyecto de Supabase está en otra región, cambia `regions` por la región de Vercel más cercana (el plan Hobby permite solo una).
5. Despliega a producción:

   ```bash
   npx vercel deploy --prod
   ```

   También puedes conectar el repositorio de GitHub en _Settings → Git_. Así cada push a `main` despliega solo.

6. Abre `https://<tu-proyecto>.vercel.app/api/health`.

**Conexiones a la base:** cada instancia de Vercel reutiliza un pool de `pg` de hasta 5 conexiones contra el transaction pooler de Supabase. `attachDatabasePool` (de `@vercel/functions`) las cierra antes de que la instancia se suspenda.

## Configurar la autenticación (fase 3)

1. **Variables** en `.env.local` (ver `.env.example`): `REQUIRE_EMAIL_VERIFICATION`, `RATE_LIMIT_SALT`, `DEMO_USER_EMAIL`, `DEMO_USER_PASSWORD`, `RESEND_API_KEY` y `EMAIL_FROM`. En producción, las mismas variables van en Vercel (ver _Desplegar en Vercel_).
2. **Migraciones y usuario demo:** `npm run db:migrate` crea el trigger que genera el perfil de cada usuario nuevo y el hook de rol; `npm run db:seed` crea (o restablece) la cuenta demo con una dirección.
3. **Supabase → Authentication → URL Configuration:** _Site URL_ = la URL pública en Vercel. En _Redirect URLs_ agrega `http://localhost:3000/auth/callback` y `https://<tu-proyecto>.vercel.app/auth/callback`.
4. **Supabase → Authentication → Hooks:** activa _Customize Access Token (JWT) Claims_ y elige la función `public.custom_access_token_hook`. Agrega `app_metadata.user_role` (`admin` o `customer`) al token.
5. **Google:** en Google Cloud Console crea un cliente OAuth (tipo _Web application_) con la URI de redirección que muestra Supabase en _Authentication → Sign In / Providers → Google_ (`https://<ref>.supabase.co/auth/v1/callback`). Pega el Client ID y el Secret en Supabase. Luego, en _OAuth consent screen_, pulsa **Publish app** para pasarla de _Testing_ a _In production_; si no, solo entran las cuentas de prueba.
6. **Resend:** crea una API key y ponla en `RESEND_API_KEY`. Para que Supabase envíe la verificación y la recuperación por Resend, en _Authentication → Emails → SMTP Settings_ usa host `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña = la API key y remitente `onboarding@resend.dev`.
7. **Promover tu usuario a admin** (en el SQL Editor de Supabase, con tu correo):

   ```sql
   update "Profile" set role = 'ADMIN' where email = 'tu-correo@ejemplo.com';
   ```

   Cierra sesión y vuelve a entrar para que el token traiga el rol nuevo; luego abre `/es/admin`.

**Rol en el JWT:** el claim `user_role` solo se actualiza cuando el token se renueva (cada hora por defecto) o al volver a iniciar sesión. El proxy (`src/proxy.ts`) usa ese claim solo para redirigir; la autorización real (`requireAdmin()`) siempre lee `Profile.role` en la base de datos, así que un rol revocado deja de servir de inmediato aunque el token diga otra cosa. En la fase 6, cambiar un rol desde el admin también cerrará las sesiones de ese usuario.

**Verificación de correo:** con `REQUIRE_EMAIL_VERIFICATION=false` el registro crea la cuenta ya confirmada (Admin API de Supabase) e inicia sesión de una vez; ese camino tiene un límite de 5 registros por hora por IP. Con `true`, Supabase envía un enlace de confirmación que vuelve a `/auth/callback`.

## Pagos (fase 5)

La tienda tiene dos pasarelas para tarjeta y PSE, y se elige con `PAYMENT_GATEWAY`:

- **`simulated` (la de la demo pública):** abrir una cuenta de comercio en Wompi, incluso solo para el sandbox, exige un negocio registrado (RUT), y esta tienda es un proyecto de portafolio. Por eso la demo usa una **pasarela simulada** propia, en `/checkout/simulated`: muestra el pedido y el monto, no pide datos de tarjeta y deja elegir **Aprobar**, **Rechazar** o **Error**. El resultado tiene la misma forma que una transacción del API de Wompi y pasa por la misma función que usa el webhook real (`applyWompiTransaction`). Por eso "Pagar de nuevo", el vencimiento, el email de pago confirmado y la protección contra doble clic se comportan igual que con Wompi. Las transacciones simuladas quedan con id `sim_…`. No hay que configurar nada.
- **`wompi`:** la integración real con el Web Checkout de Wompi, el webhook con checksum y la consulta de transacciones al API. Se activa con las llaves de un comercio, siguiendo los pasos de abajo.

Si `PAYMENT_GATEWAY` está vacío, se usa Wompi cuando las cuatro llaves existen y la pasarela simulada cuando no.

### Activar Wompi (requiere cuenta de comercio)

1. Crea una cuenta de comercio en [Wompi](https://comercios.wompi.co) y pasa el dashboard a **modo Sandbox**.
2. En _Desarrolladores → Llaves y secretos_ copia la llave pública (`pub_test_…`), la privada (`prv_test_…`), el secreto de integridad (`test_integrity_…`) y el de eventos (`test_events_…`). Ponlos en `.env.local` y en las variables de Vercel como `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET` y `WOMPI_EVENTS_SECRET`.
3. En _Desarrolladores → URL de eventos_ (sandbox) pon `https://<tu-proyecto>.vercel.app/api/webhooks/wompi`.
4. Para probar el webhook en local necesitas una URL pública: `cloudflared tunnel --url http://localhost:3000` y usa la URL que imprime + `/api/webhooks/wompi`. Sin túnel también funciona: al volver de Wompi, la página del pedido consulta la transacción en el API.
5. Datos de prueba: usa las tarjetas y bancos de la guía oficial de Wompi ("Datos de prueba en Sandbox"); en sandbox la tarjeta `4242 4242 4242 4242` se aprueba y la `4111 1111 1111 1111` se rechaza.

**Cómo se confirma un pago con Wompi:** el pedido solo pasa a **pagado** cuando el servidor lee la transacción en el API de Wompi (desde el webhook o al volver del checkout), verifica que la referencia sea de ese pedido y que el monto y la moneda coincidan. La URL de retorno nunca cambia el pedido por sí sola. Si el pago se rechaza, el pedido sigue reservado y el botón **"Pagar de nuevo"** crea un intento con otra referencia (`CS-…-A2`), máximo 5 por hora. Si nadie paga, pg_cron lo cancela a los 30 minutos y devuelve el stock.

## Pedidos (fase 4)

- **Precios con IVA incluido:** el resumen muestra subtotal, descuento, envío, base gravable (total / 1,19) e IVA. Base + IVA siempre suman el total exacto. El envío también incluye IVA.
- **Envío:** tarifa por ciudad (tabla `ShippingRate`, con una fila `DEFAULT` para el resto) y gratis cuando la compra, después del cupón, llega a $200.000.
- **Nada del navegador se usa para cobrar:** el carrito vive en el navegador, pero al confirmar el servidor vuelve a leer precios, stock, cupón y tarifa.
- **Stock seguro ante compras simultáneas:** al crear el pedido, cada variante se descuenta con un `UPDATE ... WHERE stock >= cantidad` dentro de una transacción; si no alcanza, todo se revierte. Un test con 6 compras simultáneas sobre la última unidad deja exactamente un pedido.
- **Vencimiento:** pg_cron cancela cada 5 minutos los pedidos pendientes vencidos (`ORDER_EXPIRY_MINUTES`, 30; contra entrega `COD_ORDER_EXPIRY_MINUTES`, 2880 = 48 h). Cancelar, desde el cliente, el cron o el admin, devuelve el stock y el cupón una sola vez.
- **Comprobante:** `/api/invoice/<número>` genera un PDF para el dueño del pedido o un admin. **No es una factura electrónica DIAN.**
- **Contra entrega:** el pedido queda pendiente hasta que el admin lo confirme como pagado (fase 6).

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
- **Numeración de pedidos:** sale de una secuencia de Postgres; un pedido que falla dentro de la transacción consume su número, así que puede haber saltos (CS-2026-000016, CS-2026-000020…).
- **Páginas legales:** términos, tratamiento de datos (Ley 1581) y devoluciones son **plantillas** y deben revisarlas un abogado antes de usarlas en un comercio real.
- **Supabase Free pausa el proyecto** tras unos días sin actividad. Para reactivarlo: entra a supabase.com, abre el proyecto y pulsa _Restore project_. En la fase 7b se agrega un workflow que hace ping a `/api/health` cada 3 días para evitarlo.

## Aviso

Proyecto de portafolio. Las marcas de productos son ficticias, los pagos funcionan en sandbox y los comprobantes generados **no son facturas electrónicas DIAN**.
