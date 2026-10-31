import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "rounded-md font-display text-xl font-bold tracking-tight",
        focusRing,
        className,
      )}
    >
      <span className="text-fg">Camilo</span>
      <span className="text-primary-fg">Shop</span>
    </Link>
  );
}
