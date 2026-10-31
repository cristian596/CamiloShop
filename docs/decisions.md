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

## Pendiente de confirmar con tus cuentas

- [ ] `/api/health` contra Supabase real vía Hyperdrive: latencia y `{ db: "ok" }`.
- [ ] Deploy real a `*.workers.dev` para confirmar el tamaño que reporta Cloudflare.
