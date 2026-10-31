import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

interface RatingStarsProps {
  rating: number;
  /** Accessible description, e.g. "4.5 out of 5 stars, 120 ratings". */
  label: string;
  className?: string;
}

/** Five stars filled to the nearest half; the icons are decorative. */
export function RatingStars({ rating, label, className }: RatingStarsProps) {
  const rounded = Math.round(rating * 2) / 2;

  return (
    <span
      role="img"
      aria-label={label}
      className={cn("inline-flex items-center gap-0.5", className)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = Math.min(Math.max(rounded - index, 0), 1);
        return (
          <span key={index} className="relative inline-block size-3.5" aria-hidden="true">
            <Star
              className="absolute inset-0 size-3.5 text-line"
              fill="currentColor"
              strokeWidth={0}
            />
            {fill > 0 ? (
              <span
                className={cn("absolute inset-0 overflow-hidden", fill < 1 ? "w-1/2" : "w-full")}
              >
                <Star
                  className="size-3.5 text-amber-500 dark:text-amber-400"
                  fill="currentColor"
                  strokeWidth={0}
                />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
