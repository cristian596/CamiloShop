import Link from "next/link";
import "./globals.css";

// Fallback for requests that never reach a locale segment (the middleware
// normally redirects everything to /es or /en first).
export default function RootNotFound() {
  return (
    <html lang="es" className="dark">
      <body className="grid min-h-dvh place-items-center bg-canvas p-6 font-sans text-fg">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <p className="text-7xl font-bold text-primary-fg">404</p>
          <h1 className="text-2xl font-semibold">Página no encontrada · Page not found</h1>
          <Link
            href="/es"
            className="h-11 rounded-full bg-primary px-6 leading-11 font-medium text-on-primary outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Ir al inicio · Go home
          </Link>
        </div>
      </body>
    </html>
  );
}
