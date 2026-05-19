import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-xs font-semibold text-neon-cyan shadow-glow",
        className,
      )}
      {...props}
    />
  );
}
