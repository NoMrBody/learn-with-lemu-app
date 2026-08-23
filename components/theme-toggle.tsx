"use client";

import { useId, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const CHOICES = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "system", label: "System", Icon: Monitor },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/**
 * Light / system / dark, as a three-state segmented control.
 *
 * Native radios rather than buttons with aria-pressed: a radiogroup is what
 * "one of three" actually is, and going native means arrow-key navigation,
 * focus management and screen-reader announcement all come for free and
 * correct. The inputs are visually hidden but never `display: none`, so they
 * stay focusable.
 *
 * "System" is a real third state, not a default hidden behind a two-way
 * switch — following the OS is a choice a reader should be able to return to.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const name = useId();

  // `theme` is unknown until the client has read localStorage, so the control
  // renders inert-but-sized on the server and fills in once hydrated —
  // reserving the box keeps the row from reflowing under the reader.
  //
  // useSyncExternalStore rather than the usual setState-in-an-effect: it
  // reports "hydrated" without scheduling a second render pass, which is what
  // that pattern actually costs.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <fieldset
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5",
        className,
      )}
    >
      <legend className="sr-only">Colour theme</legend>
      {CHOICES.map(({ value, label, Icon }) => {
        const active = mounted && theme === value;
        return (
          <label
            key={value}
            title={label}
            className={cn(
              "relative grid size-6 cursor-pointer place-items-center rounded-md sm:size-7",
              "transition-colors duration-(--dur-press) ease-out",
              "text-faint hover:text-fg",
              active && "bg-raised text-brand-text shadow-none",
              // The label carries the focus ring, because the input it wraps
              // is visually hidden.
              "has-[:focus-visible]:outline has-[:focus-visible]:outline-2",
              "has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={active}
              onChange={() => setTheme(value)}
              className="absolute size-full cursor-pointer opacity-0"
            />
            <Icon className="size-3.5" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
