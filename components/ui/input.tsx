import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full rounded-lg border border-line-strong bg-raised px-3 text-body text-fg",
        "placeholder:text-faint",
        "transition-[border-color,background-color] duration-(--dur-press) ease-out",
        "hover:border-faint",
        "aria-invalid:border-error",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
