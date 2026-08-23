import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * The one button.
 *
 * Diverges from stock shadcn in three ways, all of them system decisions:
 * elevation is a border and a surface step rather than a shadow (shadows are
 * invisible on the dark ground); focus is the global 2px brand outline from
 * globals.css rather than a ring; and every variant presses.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "font-medium select-none cursor-pointer",
    "transition-[background-color,border-color,color,transform] duration-(--dur-press) ease-out",
    "active:scale-[0.972] motion-reduce:active:scale-100",
    "disabled:pointer-events-none disabled:opacity-40",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-on hover:bg-brand-hover",
        secondary:
          "bg-surface text-fg border border-line hover:bg-raised hover:border-line-strong",
        outline:
          "border border-line-strong bg-transparent text-fg hover:bg-surface hover:border-faint",
        ghost: "bg-transparent text-muted hover:bg-surface hover:text-fg",
        link: "text-brand-text underline-offset-4 hover:underline px-0",
        destructive: "bg-error text-raised hover:brightness-110",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-body-sm",
        default: "h-10 rounded-lg px-4 text-body",
        lg: "h-12 rounded-lg px-5 text-body-lg font-semibold",
        /** The full-width primary action at the foot of a stage. */
        xl: "h-14 w-full rounded-xl px-5 text-body-lg font-semibold",
        icon: "size-10 rounded-lg",
        "icon-sm": "size-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
