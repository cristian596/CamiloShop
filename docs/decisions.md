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

## Deploy del catálogo (31 de octubre de 2026)

- Compilado con `NEXT_PUBLIC_SITE_URL=https://camiloshop.camilithopks6.workers.dev`; el canonical y `og:url` ya apuntan a workers.dev.
- Worker: 2,16 MiB comprimido (gzip), arranque en 17 ms.
- Tiempo hasta el primer byte medido desde Colombia (tres peticiones por ruta, la primera en frío): health 0,3–1,35 s; home 0,74–1,66 s; listado 0,32–0,69 s; ficha 0,33–1,27 s; búsqueda 0,28–0,34 s; sugerencias 0,26–0,60 s. Las rutas inexistentes devuelven 404 real.

## Fase 3: autenticación

- **Sesión:** `@supabase/ssr` con `getClaims()` en el middleware (refresca el token) y en `getCurrentUser()`, cacheado por request. El middleware redirige a `/login?next=` en `/account`, `/admin` y `/checkout`, y saca de `/login` y `/register` a quien ya tiene sesión. Es solo UX: cada página y cada server action vuelven a comprobar con `requireUser()` / `requireAdmin()`.
- **Rol:** el Custom Access Token Hook escribe `app_metadata.user_role`, no el claim `role` (Supabase lo reserva para el rol de Postgres, `authenticated`). `requireAdmin()` lee `Profile.role` en la base de datos y responde 404 a quien no es admin.
- **Perfil:** lo crea un trigger sobre `auth.users` con el nombre, el idioma y la versión de la política aceptada (metadatos del registro). La FK `Profile.id → auth.users` se reemplazó por un trigger de borrado porque Prisma rechaza las referencias entre esquemas (error P4002) y rompía `db:diff`. Borrar un usuario con pedidos falla, igual que con `ON DELETE RESTRICT`.
- **Un solo callback:** `/auth/callback` acepta `?code=` (Google y enlaces PKCE) y `?token_hash=&type=` (plantillas de correo con token hash). `next` se valida con `safeNextPath` para que no pueda redirigir a otro dominio.
- **Registro sin verificación** (`REQUIRE_EMAIL_VERIFICATION=false`): Admin API con `email_confirm: true` e inicio de sesión inmediato. Como la Admin API no tiene los límites de Supabase, se limita a 5 registros por hora por hash de IP.
- **Consentimiento (Ley 1581):** el registro exige el checkbox (validado en el servidor) y guarda `privacyAcceptedAt` y `privacyVersion`. Con Google desde la página de registro también se exige el checkbox; desde el login se muestra la nota legal.
- **Rate limiting:** tabla `RateLimitHit` con SHA-256 de `CF-Connecting-IP` + `RATE_LIMIT_SALT`. "Entrar como demo": 10 intentos cada 10 minutos. La purga de filas viejas llega con pg_cron en la fase 4.
- **Cuenta demo:** la crea o restablece `npm run db:seed`. No puede cambiar su contraseña; el restablecimiento diario de sus datos llega con pg_cron en la fase 4.
- **Emails:** `sendEmail()` llama a la API REST de Resend con `fetch`, nunca lanza excepciones y registra los fallos. Las plantillas son HTML con estilos en línea (`src/lib/email/templates.ts`) en lugar de React Email, para no sumar peso al Worker. La bienvenida se envía una sola vez: se reclama `welcomeEmailSentAt` con un `UPDATE` condicional y el envío corre en `waitUntil`.
- **Formularios:** React 19 resetea un `<form action>` después de cada acción. Eso borraba la contraseña tras un error y dejaba el `<select>` de departamento en otra opción, que se llegaba a guardar. Los formularios despachan la acción desde `onSubmit` sin reset (`submitWithoutReset`) y conservan `action` para funcionar sin JavaScript.
- **Tamaño del Worker:** 2,51 MiB comprimido (antes 2,16 MiB; la Admin API de Supabase y los formularios suman ~0,35 MiB). Quedan ~0,49 MiB del plan Free. Las fases 4–6 suman el PDF del comprobante y Recharts; si no caben, la opción prevista es Workers Paid (10 MiB).

## Deploy de la fase 3 (6 de noviembre de 2026)

- Worker: 2,51 MiB comprimido, arranque en 43 ms.
- Verificado en producción: rutas de auth, redirección de `/account` y `/admin`, "Entrar como demo", cliente rechazado en `/admin`, cierre de sesión y salida hacia Google con el retorno a `/auth/callback`.
- Verificado por API: el hook agrega `app_metadata.user_role`, Google está habilitado y los secretos del Worker existen.
- Pendiente de una prueba manual con cuentas reales: terminar el ingreso con Google, el correo de recuperación, la entrega de la bienvenida y `/admin` con el usuario admin.

## Fase 4: carrito, checkout y pedidos

- **Carrito en el navegador** (Zustand persistido, igual que las otras preferencias). Al abrir el carrito o el checkout se consultan precio y stock actuales y se avisa de cada cambio (precio, cantidad ajustada, producto retirado). Sin compra como invitado: `/checkout` exige sesión.
- **Cálculos puros** en `src/features/checkout/pricing.ts` (IVA incluido, envío por ciudad, umbral de envío gratis después del cupón, cupones PERCENT con redondeo hacia abajo y FIXED sin pasar del subtotal), con tests.
- **`placeOrder`** recibe el cliente de Prisma como parámetro para poder probarlo contra la base real. Hace todo en una transacción interactiva: recalcula, reserva stock en orden de id (evita interbloqueos), reclama el cupón con un incremento condicional (`usedCount < maxUses`), numera el pedido y crea ítems, historial, intento de pago (`<número>-A1`) y redención.
- **Cancelación en SQL** (`public.cancel_order`): bloquea la fila, solo actúa si el pedido está PENDING o PAID y, en la misma transacción, devuelve el stock, borra la redención y decrementa el cupón, anula pagos pendientes y registra el historial. Llamarla dos veces no devuelve nada dos veces. La usan el cliente, el cron y (en la fase 6) el admin. Las funciones tienen `EXECUTE` revocado a `anon` y `authenticated`, y un test confirma que la Data API no puede llamarlas.
- **pg_cron:** `expire-pending-orders` (cada 5 min), `purge-rate-limit-hits` (diario) y `reset-demo-data` (diario, 03:00 en Bogotá: cancela pedidos pendientes del demo y borra sus favoritos y direcciones extra). El correo del demo se guarda en `Setting.demoUserEmail` desde el seed.
- **Comprobante PDF con pdf-lib** (JavaScript puro, funciona en Workers). Usa las fuentes estándar de PDF; los caracteres fuera de WinAnsi (emojis) se reemplazan por "?".
- **Email de confirmación:** se envía en `waitUntil` y nunca bloquea el pedido. Con el usuario demo (`example.com`) Resend lo rechaza y el error queda en los logs; es lo esperado.
- **Tamaño del Worker: 2,77 MiB comprimido** (antes 2,51; pdf-lib y el checkout suman ~0,26 MiB). Quedan ~0,23 MiB del plan Free. Wompi (fase 5) es poco código, pero el admin con Recharts (fase 6) casi seguro no cabe: hay que decidir entre Workers Paid (USD 5/mes, 10 MiB) o recortar.

## Deploy de la fase 4 (7 de noviembre de 2026)

- Probado en producción como demo: carrito, cupón GEMINI5, pedido contra entrega, PDF y cancelación.
- **Zona horaria:** Workers corre en UTC, así que las fechas salían 5 horas adelantadas. `src/i18n/request.ts` fija `timeZone: "America/Bogota"` para servidor y cliente.
- **`keep_names: false` en `wrangler.jsonc`:** el esbuild de wrangler inyectaba un helper `__name()` dentro del script anti-parpadeo de next-themes y el navegador lanzaba `ReferenceError: __name is not defined` en todas las páginas. Es el arreglo que recomienda OpenNext (https://opennext.js.org/cloudflare/howtos/keep_names).
- **Límite de CPU del plan Free:** `wrangler tail` mostró entre 58 y 498 ms de CPU por request (render de Next.js y server actions), contra 10 ms por request en Free. Cloudflare tolera excesos ocasionales pero corta los Workers que lo superan seguido; un 503 en la primera cotización del checkout fue casi seguro eso. Workers Paid sube el límite a 30 s por defecto.
- **Tamaño:** la documentación de límites ya no fija un máximo comprimido (64 MiB sin comprimir en ambos planes); el Worker pesa 2,69 MiB comprimido. El riesgo real del plan Free es la CPU, no el tamaño.

## Fase 5: pagos con Wompi (sandbox)

- **Web Checkout por formulario GET** firmado en el servidor (`signature:integrity` = SHA-256 de referencia + monto + moneda + `expiration-time` + secreto). La expiración del pedido va en la firma, así que Wompi no acepta pagos de un pedido vencido. También se envían el IVA (`tax-in-cents:vat`), los datos del cliente y la dirección.
- **El método se elige en la tienda** (tarjeta, PSE o contra entrega), pero Wompi deja pagar con cualquier medio; al aprobarse, el pedido guarda el medio real si es tarjeta o PSE.
- **Webhook** `/api/webhooks/wompi`: checksum con comparación en tiempo constante (401 si falla), eventos de otro ambiente ignorados, idempotencia con `WebhookEvent.eventKey` (`txId:status:timestamp`; un evento registrado pero sin `processedAt` se reprocesa), y siempre se vuelve a leer la transacción en el API (si el API no responde, 500 para que Wompi reintente). El payload nunca decide el estado.
- **`applyWompiTransaction`** (con el cliente de Prisma como parámetro, probado contra la base real): valida referencia, monto y moneda; un estado final reportado por Wompi no cambia; la aprobación pasa el pedido de PENDING a PAID con un `UPDATE` condicional (dos llamadas simultáneas pagan una sola vez), suma `soldCount` y registra el historial.
- **Aprobación tardía:** si el pedido ya se canceló, `cancel_order` había anulado el intento localmente. Esa anulación local (sin transacción de Wompi) sí acepta la aprobación posterior, que queda registrada como `approvedAfterCancel` para reembolso manual en el admin. Sin esto, un pago cobrado en el último segundo se habría ignorado.
- **Retorno del checkout:** la página del pedido recibe `?id=<transacción>` y lo trata como una pista: consulta el API y aplica la transacción solo si su referencia es de ese pedido. Así el flujo funciona en local sin túnel; mientras siga pendiente (PSE), la página se refresca sola cada 4 s durante un minuto. Se usó la página del pedido en lugar de un `/checkout/result` aparte.
- **Ejemplo de la documentación de eventos:** el checksum impreso junto al ejemplo no corresponde al SHA-256 de su propia cadena; el test valida la concatenación documentada. La firma de integridad sí coincide con su ejemplo.
- **Email "pago confirmado"** con la plantilla genérica de cambio de estado, que la fase 6 reutiliza para enviado, entregado y cancelado.
- Worker: 2,70 MiB comprimido.
- **Pasarela simulada (7 de noviembre de 2026).** Una cuenta de comercio en Wompi, incluso solo para el sandbox, exige un negocio registrado (RUT), y este es un proyecto de portafolio. Opciones evaluadas:
  - sacar un RUT de persona natural: es un trámite real solo para la demo;
  - cambiar a PayU, que tiene credenciales de sandbox públicas: obliga a reescribir la firma, el webhook y los tests.

  Se eligió una pasarela simulada propia, `PAYMENT_GATEWAY=simulated`, que es la opción por defecto cuando no hay llaves:
  - `/checkout/simulated` reemplaza al Web Checkout. Solo la ve el dueño de un intento PENDING, sin transacción, en un pedido vigente.
  - El cliente elige Aprobar, Rechazar o Error. No se pide ningún dato de tarjeta.
  - El intento se reclama primero con un `UPDATE` condicional sobre `providerTxId`, así un doble clic lo resuelve una sola vez.
  - Luego se construye una transacción con la forma del API de Wompi y se aplica con `applyWompiTransaction`, la misma función del webhook.
  - Se conserva `provider = WOMPI` (sin migración) y las transacciones simuladas se distinguen por el id `sim_…`.

  El código real de Wompi no cambió: queda listo para activarse con las llaves.

## Deploy de la pasarela simulada (7 de noviembre de 2026)

- Versión `83b9943e`, 2,71 MiB comprimido. En producción un pedido con "Aprobar pago" quedó PAID en la base al instante.
- **Caché de Hyperdrive desactivada** (`wrangler hyperdrive update <id> --caching-disabled`). Venía activada por defecto y servía lecturas de hasta 60 s de antigüedad: el pedido recién pagado seguía viéndose "Pendiente", y lo mismo pasaba con el stock, las direcciones y los favoritos. Hyperdrive sigue haciendo pooling de conexiones.
- **Límite de CPU del plan Free:** medido con `wrangler tail`, las peticiones que terminan bien usan entre 23 y 637 ms de CPU, y cerca de la mitad muere a los 10 ms con `exceededCpu` (503). Pasa incluso con `/api/health`, así que lo que pesa es arrancar el bundle de Next.js y no una página en particular: recortar código de las páginas no lo resuelve.

## Migración a Vercel (9 de noviembre de 2026)

Reemplaza las decisiones de hosting de la fase 1 (Cloudflare Workers + OpenNext + Hyperdrive) y la de `middleware.ts`.

- **Por qué:** en Workers Free cerca de la mitad de las peticiones moría a los 10 ms de CPU (ver la sección anterior). Workers Paid costaba USD 5 al mes. Se eligió **Vercel Hobby**, que es gratis, corre Next.js de forma nativa y no tiene un límite de CPU de 10 ms. Hobby es para uso no comercial, lo que encaja con un portafolio.
- **Base de datos:** Prisma 7 con `@prisma/adapter-pg` y un `Pool` de `pg` compartido por instancia (máximo 5 conexiones), registrado con `attachDatabasePool` de `@vercel/functions`. Es el patrón de la guía de Prisma para Vercel Fluid compute.
  - `DATABASE_URL` apunta al **transaction pooler de Supabase (6543)**.
  - Los 25 tests de integración pasan contra ese pooler: concurrencia de stock, transacciones interactivas, `cancel_order` y pagos.
  - `DIRECT_URL` (session pooler) queda para migraciones, seed y tests.
  - Ya no hace falta un cliente por request ni `maxUses: 1`, que eran limitaciones de Workers.
- **Trabajo en segundo plano:** `runInBackground` usa `after()` de Next.js, que en Vercel equivale a `waitUntil`.
- **Proxy:** `src/middleware.ts` pasó a `src/proxy.ts`, la convención de Next 16, que corre en Node.js. En OpenNext era experimental; en Vercel está soportado.
- **IP para el rate limit:** antes se leía `CF-Connecting-IP`. En Vercel ese header lo puede mandar cualquier cliente, así que se habría podido falsear para saltarse el límite de "Entrar como demo". Ahora se usa `x-vercel-forwarded-for` / `x-forwarded-for`, que Vercel sobrescribe.
- **Región:** `vercel.json` fija `pdx1` (Portland), junto al pooler de Supabase en `us-west-2`.
- **Prisma:** se quitó `compilerBuild = "small"`, que solo servía para el límite de tamaño del Worker.
- **Dependencia nueva:** `@vercel/functions@3.11.1`, publicada el mismo día. Se eligió esa versión porque las anteriores arrastraban `zod < 4.6.6`, con un aviso de seguridad alto (GHSA-mrhx-c7xc-m3w5).
- **Se eliminó:** `wrangler.jsonc`, `open-next.config.ts`, `cloudflare-env.d.ts`, `.dev.vars.example` y las dependencias `@opennextjs/cloudflare` y `wrangler`. El Worker `camiloshop` y el Hyperdrive `camiloshop-db` siguen existiendo en la cuenta de Cloudflare hasta que se borren a mano.

## Fase 6: panel de administración (9 de noviembre de 2026)

- **Autorización:** `requireAdmin()` en el layout y en cada página, y `getAdminActor()` al inicio de cada Server Action, porque las acciones son endpoints POST públicos. Ambos leen `Profile.role` e `isActive` de la base de datos; el claim del JWT solo sirve para la redirección del proxy. El `loading.tsx` vive dentro del layout, que valida antes de transmitir nada, así que un no-admin recibe un 404 real.
- **Cambios de estado:** `changeOrderStatus` aplica la misma máquina de estados de la tienda, con una restricción: tarjeta y PSE solo pasan a PAID por la pasarela. Es un `UPDATE` condicional sobre el estado que el admin vio, así que dos admins (o el admin y el cron) no pueden ganar los dos. Confirmar contra entrega aprueba el pago COD y suma `soldCount` (helper compartido con el webhook). Las cancelaciones usan `cancel_order`.
- **`cancel_order` corregido:** cancelar un pedido PAID no restaba sus unidades de `soldCount`. La migración `20261109180000_admin` reemplaza la función, que conserva el mismo contrato (idempotente y con bloqueo de fila).
- **Reembolsos:** `Payment.reviewedAt`. Un pago APPROVED en un pedido CANCELLED (una aprobación tardía o un pedido pagado que se canceló) aparece en el Resumen hasta que un admin lo marca como revisado. En sandbox no hay reembolsos reales.
- **Productos y variantes:** `saveProduct` reconcilia las variantes en una transacción. Actualiza las que traen id (solo si son de ese producto), crea las nuevas y borra las que faltan, salvo si tienen pedidos (`variantInUse`). Después de guardar se recarga la página, así el formulario recibe los ids nuevos y un segundo guardado no duplica variantes.
- **Imágenes:** se suben con una Server Action (límite de cuerpo de 3 MB en `next.config.ts`; Vercel acepta 4,5 MB) a Supabase Storage con la service role. El tipo se detecta por los bytes (JPEG, PNG, WebP o AVIF), no por el nombre ni por el MIME que manda el navegador. El bucket repite los límites de tamaño y tipo, y cada archivo tiene un nombre UUID único. Al borrar, el archivo se elimina de Storage; la CDN puede seguir sirviendo la copia cacheada a esa URL, lo cual no importa porque nada vuelve a enlazarla.
- **Usuarios:** un cambio de rol o una desactivación borran `auth.sessions` (invalida los refresh tokens), y desactivar además banea en Supabase Auth. No se permite cambiar el propio rol ni promover la cuenta demo.
- **Gráficas:** Recharts 3.10.1 se carga con `next/dynamic` y `ssr: false` solo en el Resumen. Los colores vienen de los tokens CSS del tema. La barra de "más vendidos" es un `<progress>` estilizado con variantes de Tailwind, para no usar `style`.
- **Versión legal `2026-11-09`:** la política de privacidad ya nombra a Vercel como proveedor de alojamiento.
- **Verificado en el navegador** (Chrome, cuenta admin, `localhost`): Resumen, pedidos (pagado → enviado con nota → entregado), crear un producto, subirle una imagen y eliminarlo (el archivo desaparece de Storage), y validar, crear y eliminar un cupón.

## Fase 7a: reseñas, preguntas y SEO (10 de noviembre de 2026)

- **Calificaciones reales:** el seed guardaba promedios inventados (por ejemplo, 4,7 con 128 reseñas que no existían). Publicarlos como `aggregateRating` habría sido presentar reseñas falsas como genuinas, algo que contradice las pautas de datos estructurados de Google y engaña al visitante. La migración `20261110120000_social` recalcula `ratingAvg` y `ratingCount` desde la tabla `Review`, y el seed ya no los escribe. El costo es que el catálogo arranca sin estrellas.
- **Elegibilidad:** `createReview` bloquea la fila del producto (`FOR UPDATE`), verifica que exista un pedido DELIVERED del usuario con ese producto, inserta la reseña y recalcula el promedio, todo en una transacción. El índice único `(productId, userId)` garantiza una reseña por cliente (P2002 → `alreadyReviewed`). Hay un rate limit de 10 reseñas por hora por usuario.
- **Preguntas con moderación ligera:** una pregunta se publica al ser respondida. Es lo mínimo para no exponer texto arbitrario sin revisar en una tienda pública, y el autor la ve como pendiente. El rate limit es de 5 por hora, en la misma tabla `RateLimitHit`.
- **Nombres públicos:** nombre y la inicial del apellido ("Camilo H."), nunca el correo.
- **Reinicio de la demo:** `reset_demo_data()` ahora borra las reseñas y preguntas del cliente demo y recalcula las calificaciones afectadas. El seed le crea un pedido entregado si no tiene ninguno.
- **SEO:** `localizedAlternates()` centraliza el canonical y el hreflang con `x-default`. El JSON-LD se serializa escapando `<` (guía de Next.js), porque el texto de las reseñas viene de usuarios. El sitemap es `force-dynamic` para no consultar la base durante el build y estar siempre al día con el admin.
- **Excepción de estilos:** `opengraph-image.tsx` usa estilos en línea porque `ImageResponse` (Satori) dibuja el PNG sin leer la hoja de Tailwind. Es el único lugar con estilos fuera de Tailwind, y no es CSS de la página.
- **Errores encontrados al probar:** un `<form>` (el botón de borrar) estaba dentro de un `<p>` en reseñas y preguntas, lo que daba un error de hidratación; ahora es un `<div>`. La migración intentaba crear un CHECK de `rating` que ya existía desde la migración inicial; se quitó y se reaplicó con `prisma migrate resolve --rolled-back`.

## Fase 7b: analítica, E2E y CI (10 de noviembre de 2026)

- **Consent Mode v2 en modo básico:** en el modo avanzado, `gtag.js` envía señales sin cookies antes del consentimiento. El plan pedía que GA no enviara nada antes de aceptar, así que el script ni siquiera se pide hasta entonces. Al aceptar se fijan los valores por defecto en _denied_ y se concede solo `analytics_storage`. No se usa `@next/third-parties` (sigue marcado como experimental): son dos `next/script`, y el ID se valida con una expresión regular antes de interpolarlo en el script.
- **La cookie `cs_consent`** guarda una versión (`v1.granted`). El layout la lee en el servidor, así que el banner no parpadea a quien ya eligió.
- **Playwright 1.64.1 + @axe-core/playwright 4.14.0:** se fijó `playwright-core` en 1.64.1 porque axe traía otra versión y los tipos chocaban. Los E2E corren con un solo worker, porque la compra usa la cuenta demo compartida. El test de cookies se salta si el servidor no tiene ID de GA, y responde localmente las peticiones a Google, así que nunca sale a internet.
- **CI contra una Supabase local:** usa `supabase/setup-cli@v3` (Node 24) con la CLI 2.122.0 y excluye studio, realtime, edge functions, logs, imgproxy, mailpit, postgres-meta y supavisor. Las variables salen de `supabase status -o env`, con los nombres por defecto (`API_URL`, `ANON_KEY`…), porque `--override-name` solo acepta un valor.
- **Validado en Docker local antes de subirlo:** las 8 migraciones se aplican sobre una base vacía, el seed crea el catálogo y el pedido entregado del demo, pasan los 188 tests de Vitest, el build y los 12 E2E. Apareció un fallo que solo existía en una base nueva: el test de reseñas suponía que había un segundo usuario. Ahora crea el suyo.
- **Lighthouse** (Chrome sin interfaz, producción): 100 en Accesibilidad, Buenas prácticas y SEO, en el inicio y en una ficha de producto.
