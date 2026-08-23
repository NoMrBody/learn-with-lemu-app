import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge has to be taught this project's type scale.
 *
 * Out of the box it only recognises Tailwind's stock font sizes, so a custom
 * one like `text-body` falls through to its text-*colour* group. That put
 * `text-body` and `text-brand-on` in the same group, and the later one won —
 * silently dropping the colour and leaving buttons with inherited text. Any
 * custom `text-<name>` size has to be listed here for that not to happen.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h1",
            "h2",
            "h3",
            "body-lg",
            "body",
            "body-sm",
            "label",
            "eyebrow",
            "num-lg",
            "num",
          ],
        },
      ],
    },
  },
});

/** Merge conditional class names, letting later Tailwind utilities win. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
