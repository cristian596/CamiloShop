import { cn } from "@/lib/cn";

interface SectionHeadingProps {
  id: string;
  title: string;
  description?: string;
  className?: string;
}

export function SectionHeading({ id, title, description, className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-8 flex flex-col gap-2", className)}>
      <h2 id={id} className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h2>
      {description ? <p className="text-muted">{description}</p> : null}
    </div>
  );
}
