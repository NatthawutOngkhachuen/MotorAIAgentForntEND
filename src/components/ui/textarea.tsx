import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "min-h-28 w-full rounded-md border border-border bg-carbon-950/70 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
