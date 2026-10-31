"use client";

import { useEffect } from "react";
import "./globals.css";

// Rendered when the root layout itself fails, so no i18n provider is available:
// the copy is shown in both languages.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es" className="dark">
      <body className="grid min-h-dvh place-items-center bg-canvas p-6 font-sans text-fg">
        <div role="alert" className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-semibold">Algo salió mal · Something went wrong</h1>
          <p className="text-muted">Ocurrió un error inesperado. · An unexpected error occurred.</p>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-full bg-primary px-6 font-medium text-on-primary outline-none hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Reintentar · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
