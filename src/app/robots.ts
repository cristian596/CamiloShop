import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * Private and transactional areas stay out of search results. They are also
 * marked noindex on the pages themselves (robots.txt alone does not de-index).
 */
const PRIVATE_PATHS = [
  "/account",
  "/admin",
  "/checkout",
  "/cart",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        ...PRIVATE_PATHS.flatMap((path) => [`/es${path}`, `/en${path}`]),
      ],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
