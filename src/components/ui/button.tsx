import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./styles";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover shadow-lg shadow-violet/20",
  outline: "border border-line bg-transparent text-fg hover:bg-surface-raised",
  ghost: "bg-transparent text-fg hover:bg-surface-raised",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-base",
  icon: "size-10",
};

/** Class names for button-styled elements (also used to style links). */
export function buttonClasses(
  options: { variant?: Variant; size?: Size; className?: string } = {},
) {
  const { variant = "primary", size = "md", className } = options;
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
    focusRing,
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}
