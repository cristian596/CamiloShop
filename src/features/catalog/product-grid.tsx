import type { ProductSummary } from "./queries";
import { ProductCard } from "./product-card";

export function ProductGrid({
  products,
  priorityCount = 4,
}: {
  products: ProductSummary[];
  priorityCount?: number;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} priority={index < priorityCount} />
        </li>
      ))}
    </ul>
  );
}
