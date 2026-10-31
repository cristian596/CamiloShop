import type { ReactNode } from "react";
import "./globals.css";

// The <html> and <body> tags live in app/[locale]/layout.tsx so `lang` matches the locale.
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
