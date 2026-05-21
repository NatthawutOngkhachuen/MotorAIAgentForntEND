import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <Badge className="mb-3">{eyebrow}</Badge> : null}
        <h1 className="moto-heading text-4xl sm:text-5xl">
          {title}
        </h1>
        {description ? <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
