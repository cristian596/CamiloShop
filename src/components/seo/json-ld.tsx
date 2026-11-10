import { jsonLdString } from "@/lib/seo";

/** Structured data for search engines (a plain script tag, per the Next.js guide). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />
  );
}
