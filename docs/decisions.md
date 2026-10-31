# Decisiones técnicas — Spike de la fase 1

Fecha: 31 de octubre de 2026. Las mediciones se hicieron con `opennextjs-cloudflare build` y `wrangler deploy --dry-run`, y el Worker se ejecutó localmente en workerd (`wrangler dev`).

## Versiones fijadas

| Paquete                                      | Versión | Nota                                                                           |
| -------------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| next                                         | 16.4.3  | Rango soportado por `@opennextjs/cloudflare` 1.20.15 (`>=16.4.1`).             |
| @opennextjs/cloudflare                       | 1.20.15 |                                                                                |
| wrangler                                     | 4.156.0 |                                                                                |
| prisma / @prisma/client / @prisma/adapter-pg | 7.10.1  | Última estable. En npm, `latest` apunta a una RC de Prisma 8, que se descartó. |
| typescript                                   | 6.0.3   | TS 7 se descartó porque typescript-eslint solo soporta `<6.1`.                 |
| eslint                                       | 9.39.5  | Algunos plugins de `eslint-config-next` todavía no soportan ESLint 10.         |
| tailwindcss                                  | 4.3.3   | Configuración en CSS (`@theme`).                                               |

## 1. ORM: **Prisma 7** (se queda, Drizzle no hace falta)

- Configuración que funciona en Workers: generador `prisma-client-js` **sin `output` propio**, `compilerBuild = "small"`, `serverExternalPackages: ["@prisma/client", ".prisma/client"]` y `@prisma/adapter-pg` con `maxUses: 1`, más un cliente por request vía `getCloudflareContext()`.
- Se descartó el generador nuevo `prisma-client` con `runtime = "cloudflare"`. Con webpack falla porque importa `*.wasm?module`, y con Turbopack, al construir con OpenNext en Windows, falla por symlinks. La guía oficial de OpenNext pide `prisma-client-js` para poder parchear el cliente para workerd.
- `prisma-client-js` está marcado como _deprecated_ en Prisma 7, pero sigue soportado. Si en el futuro OpenNext soporta el generador nuevo, la migración se limita a cambiar el generador y el import en `src/lib/db.ts`.

## 2. Tamaño del Worker: **cabe en el plan Free**

| Configuración                               | Total    | gzip (lo que cuenta para el límite) |
| ------------------------------------------- | -------- | ----------------------------------- |
| Prisma con compilador `fast`                | 10,1 MiB | 2,57 MiB                            |
| **Prisma con compilador `small`** (elegida) | 8,5 MiB  | **2,13 MiB**                        |
| Variante con `proxy.ts`                     | 8,9 MiB  | 2,20 MiB                            |

- El límite de Free es 3 MiB comprimido, así que quedan unos **0,87 MiB de margen**. El WASM de Prisma `small` pesa unos 0,6 MiB comprimido.
- Vigilancia: hay que volver a medir al cerrar cada fase con `npm run cf:build && npm run cf:size`. Recharts y `pdf-lib` se cargarán con import dinámico.
- **Si se supera el límite:** pasar a Workers Paid (USD 5/mes, 10 MiB) antes que cambiar de ORM.

## 3. Middleware: **`middleware.ts`**, con `proxy.ts` como plan B ya probado

- Las dos variantes compilan y funcionan en workerd: redirección `/` → `/es`, i18n y el código 404 correcto.
- Next 16 muestra un aviso de _deprecated_ para `middleware.ts`, pero en OpenNext es el camino estable.
- `proxy.ts` (runtime Node) funciona, pero OpenNext lo marca como _"experimental… not officially maintained"_ y suma unos 80 KiB.
- Para migrar: renombrar `src/middleware.ts` a `src/proxy.ts` y la función `middleware` a `proxy`.

## 4. Build con webpack (`next build --webpack`)

En Windows, OpenNext sobre la salida de Turbopack falla con `EPERM: operation not permitted, symlink` al copiar `@prisma/client`, porque Turbopack crea symlinks para los paquetes externos. Con webpack no pasa. `next dev` sigue usando Turbopack.
Alternativas si algún día se prefiere Turbopack: activar el Modo de Desarrollador de Windows (permite crear symlinks sin ser administrador), compilar en WSL o compilar solo en CI (Linux).

## 5. Otros hallazgos

- **`loading.tsx` en la raíz de `[locale]`** hacía que las páginas inexistentes respondieran **200** en lugar de 404 (el streaming empieza antes de `notFound()`). Los skeletons se montan por ruta con `PageSkeleton`, nunca en la raíz.
- **Hyperdrive en local:** wrangler exige `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` incluso para `next build` y `next dev`.
- **Cliente de Prisma por request:** en Workers no se pueden reutilizar conexiones TCP entre requests. `getDb()` usa `cache()` de React para deduplicar dentro de un render, y `/api/health` hace `$disconnect()` en `waitUntil`.

## Verificación con cuentas reales (31 de octubre de 2026)

- **Deploy:** `https://camiloshop.camilithopks6.workers.dev`. Cloudflare reportó 2,13 MiB comprimido y un _startup time_ de 13 ms.
- **`/api/health` en producción (Hyperdrive → Supabase `us-west-2`):** `{ db: "ok" }`. La primera petición tardó 230 ms; las siguientes, entre 3 y 25 ms. Hyperdrive mantiene un pool de conexiones y además cachea las lecturas, así que ese número tan bajo de `SELECT 1` sale en parte de la caché. Las consultas reales del catálogo se medirán en la fase 2a.
- **Worker local (workerd) sin Hyperdrive:** unos 700 ms por petición, porque cada request abre una conexión TLS nueva hasta Oregón.
- **Rutas:** `/` → 307 `/es`, `/es` y `/en` → 200, ruta inexistente → 404, y headers de seguridad presentes.
- **RLS:** la tabla `Setting` tiene RLS activo sin políticas. Con la anon key, `SELECT` devuelve `[]` y `INSERT` es rechazado (`42501`). Toda tabla nueva del esquema `public` debe nacer con RLS.
- **Región:** el proyecto de Supabase quedó en `us-west-2` (Oregón) y no en `sa-east-1`. Funciona, pero suma latencia desde Colombia en las consultas que no se cachean.
- **Deploy desde Windows:** `opennextjs-cloudflare deploy` también exige `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` en el entorno del proceso; no lee `.env.local`.

# Fase 2a — Esquema, seed y listado

## Migraciones: Prisma Migrate + SQL escrito a mano en la misma migración

- La migración `prisma/migrations/20261031120000_init` se generó con `prisma migrate diff --from-empty`. Al final se le agregó a mano lo que Prisma no sabe expresar: extensiones (`pg_trgm` y `unaccent` en el esquema `extensions`), la función `immutable_unaccent()`, índices GIN trigram sobre los nombres, CHECKs (stock ≥ 0, totales coherentes, rating 1–5…) y **RLS en las 21 tablas**.
- Un solo historial de migraciones en lugar de una carpeta `supabase/migrations` aparte, para que el esquema y sus políticas no se desincronicen.
- Se aplica con `npm run db:migrate` (`prisma migrate deploy`), que no necesita _shadow database_ (Supabase no permite crearla fácilmente).
- **Comprobado:** `npm run db:diff` sale vacío después de aplicar la migración, así que Prisma ignora los CHECKs y los índices de expresión y no intentará borrarlos. Aun así, cada migración nueva generada con `db:diff` debe revisarse antes de aplicarla.
- La tabla `Setting` del spike de la fase 1 estaba vacía; se eliminó para que la cree la migración `init`.

## RLS

- Prisma se conecta como dueño de las tablas y **se salta RLS**; la autorización de esas rutas va en el servidor. RLS protege la Data API de Supabase, a la que se llega con la anon key pública.
- **Lectura pública:** categorías, marcas, productos activos con sus imágenes y variantes, reseñas, preguntas y respuestas.
- **Lectura solo del dueño:** perfil, direcciones, favoritos, pedidos (con sus ítems, historial y pagos) y cupones canjeados.
- **Sin políticas (solo servidor):** `Setting`, `ShippingRate`, `Coupon`, `WebhookEvent` y `RateLimitHit`.
- **Ninguna política de escritura:** toda escritura pasa por el servidor.
- Lo verifica `tests/integration/rls.test.ts` (11 casos con la anon key real). Se omite solo si no hay variables de Supabase.

## Datos de catálogo

- **Precios:** enteros en COP con IVA incluido. Las variantes pueden sobrescribir el precio (`priceOverride`), por ejemplo 256 GB o 100 ml.
- **Colores:** se guardan como clave (`black`, `navy`…) y se traducen en `messages/*.json`. Los swatches usan clases literales de Tailwind (`COLOR_SWATCH_CLASSES`), no `style`, y un test garantiza que coinciden con los hex.
- **`ratingAvg` / `ratingCount` / `soldCount`:** son valores de demostración sembrados. En la fase 7a el rating se recalculará a partir de reseñas reales.
- **Imágenes:** 40 fotos de Unsplash (licencia gratuita, sin Unsplash+), revisadas una por una para **descartar marcas registradas visibles**. Se reemplazaron fotos con logos de Nike, Puma, Ray-Ban, Chanel, Armani, Too Faced, Bobbi Brown y Curology, entre otras. Por eso algunos productos del plan cambiaron: los controles pasaron a ser diadema y monitor, y los tenis, tacones y botas.
- **Seed idempotente:** hace upsert por `slug`, `sku`, `code` y `city`. Si se renombra el slug de un producto, el anterior queda en la base y hay que borrarlo a mano (se hizo con 4 productos durante esta fase).

## Listado

- **Filtros en la URL** con un formulario GET: funcionan sin JavaScript y cada estado es un enlace que se puede compartir. `CleanGetForm` quita los campos vacíos del query.
- **El parser (`parseListingParams`) nunca lanza errores:** descarta valores inválidos, corrige rangos invertidos y limita la cantidad de valores. Tiene tests.
- **Talla y color filtran sobre la misma variante.** Por ejemplo, "M negra" no incluye una prenda que solo tenga M en blanco y negro en XL.
- **404 reales:** la categoría se resuelve **antes** del streaming. Solo los resultados van dentro de `<Suspense>` (con el skeleton), con una `key` por query para que el skeleton vuelva a aparecer con cada filtro. No se usa `loading.tsx` en rutas que pueden dar 404.
- **Render dinámico:** el layout de `[locale]` usa `dynamic = "force-dynamic"`, porque todas las páginas leen datos vivos (tasa USD, precios, stock) y todavía no hay caché incremental configurada en Cloudflare.
- **Tasa USD:** se lee de `Setting.usdRate` en el layout y llega a los componentes por contexto (`StoreConfigProvider`). Si la base falla, se usa la del entorno.
- **Imágenes con `next/image`:** usan un loader propio que pide a Unsplash el ancho exacto (`w`, `q`, `auto=format`), así que no hace falta Cloudflare Images.
- **Tamaño del Worker:** 2,14 MiB comprimido (+18 KiB respecto a la fase 1).

# Fase 2b — Ficha de producto, búsqueda, relacionados y vistos

## Ficha de producto (`/p/[slug]`)

- **404 real** para productos inexistentes o inactivos: el producto se resuelve antes del streaming. Solo los relacionados van en `<Suspense>`.
- **Variantes:** la lógica pura vive en `features/catalog/variants.ts` y tiene tests. Al cambiar de talla se conserva el color si esa combinación existe; si no, se elige una variante con stock. Las opciones agotadas se muestran tachadas, pero se pueden seleccionar para ver su estado.
- **Variante en la URL** (`?variant=<sku>`): se actualiza con `history.replaceState`, sin pedir nada al servidor, y el servidor la lee para el render inicial. Así un enlace compartido abre la variante exacta sin desajustes de hidratación.
- **Precio:** usa el `priceOverride` de la variante cuando existe. El precio anterior solo se muestra si es mayor que el actual.
- **"Agregar al carrito"** está deshabilitado con una nota visible ("disponible muy pronto") hasta la fase 4.
- **Compartir:** usa la Web Share API si existe y, si no, copia el enlace. El resultado se anuncia con `role="status"`.
- **Metadatos:** título, descripción, canonical, `hreflang` y Open Graph con la imagen recortada a 1200×630 por Unsplash. El JSON-LD `Product` llega en la fase 7a.

## Búsqueda

- **Sin servicio externo:** Postgres con `unaccent` + `pg_trgm`. Cada palabra debe aparecer en el nombre (es o en), la marca o la categoría. El orden es por `word_similarity` y luego por más vendidos. `EXPLAIN` confirma que se usa el índice `Product_nameEs_trgm_idx`.
- **Seguridad:** las consultas usan `$queryRaw` con parámetros, nunca concatenación. Los comodines `%` y `_` del usuario se escapan, y la consulta se limita a 80 caracteres y 6 palabras.
- **Sugerencias:** `GET /api/search/suggest?q=` devuelve hasta 6 productos con `Cache-Control: public, max-age=60`.
- **Buscador del header:** sigue el patrón combobox ARIA (lista con autocompletado), con `aria-activedescendant`, flechas, Enter y Escape, y un aviso para lectores de pantalla. La última opción es "Ver todos los resultados". Sin JavaScript es un formulario GET normal a `/search`.
- **Página `/search`:** es `noindex, follow`, porque las páginas de resultados son contenido duplicado casi infinito.

## Relacionados y vistos recientemente

- **Relacionados**, en orden de prioridad: misma subcategoría, misma marca y resto de la categoría padre. Dentro de cada grupo, los más vendidos.
- **Vistos recientemente:** un store de Zustand persistido en localStorage, con un máximo de 12 y sin duplicados. Se muestra en la ficha (sin repetir el producto actual) y en la home. Se registra la vista solo **después** de que el store se hidrata, porque el efecto del hijo corre antes que el `rehydrate()` del padre y, si no, la vista se perdería.

## Otros

- `Pagination` ahora recibe `hrefForPage`, así sirve para categorías y búsqueda.
- Un test verifica que `messages/es.json` y `messages/en.json` tengan exactamente las mismas claves y ningún texto vacío.
- **Tamaño del Worker:** 2,16 MiB comprimido.
- **URL canónica:** `NEXT_PUBLIC_SITE_URL` se incrusta al compilar. Para el deploy hay que compilar con la URL pública (ver README); si no, el canonical y el Open Graph apuntan a `localhost`.
