import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";
import { cn } from "@/lib/utils";

/**
 * The lemur mark. Only the height is set — the width follows from the static
 * import's intrinsic ratio, so the image is never squashed and the aspect
 * lives in one place (the file) rather than in every call site.
 *
 * Decorative by default: every current use sits next to the word "LeMiu", so
 * an alt would just make screen readers say the name twice. Pass a label on
 * any future use where the mark stands alone.
 */
export function Logo({
  className = "h-5 w-auto",
  sizes = "24px",
  priority = false,
  label = "",
}: {
  className?: string;
  sizes?: string;
  priority?: boolean;
  label?: string;
}) {
  // `sizes` is not optional in practice: the height comes from CSS, so without
  // it the browser sizes the srcset off the viewport and can pull a 3840px
  // render of a 20px mark. Keep it roughly the drawn width.
  return (
    <Image
      src={logo}
      alt={label}
      sizes={sizes}
      priority={priority}
      className={className}
    />
  );
}

/**
 * Mark plus wordmark, linking home. The wordmark is set in mono small-caps —
 * the mark itself is achromatic, so the type is what has to carry the name.
 */
export function Wordmark({
  className,
  markClass = "h-6 w-auto",
  sizes = "28px",
  priority = false,
}: {
  className?: string;
  markClass?: string;
  sizes?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-md",
        "transition-opacity duration-(--dur-press) ease-out hover:opacity-80",
        className,
      )}
    >
      <Logo className={markClass} sizes={sizes} priority={priority} />
      <span className="font-mono text-eyebrow uppercase text-fg max-[400px]:hidden">
        LeMiu
      </span>
    </Link>
  );
}

/**
 * "← LeMiu" home link, used at the top of pages that would otherwise be dead
 * ends. The arrow and wordmark stay: the mark on its own reads as decoration,
 * not as a way back.
 */
export function HomeLink({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-mono text-eyebrow uppercase",
        "text-muted transition-colors duration-(--dur-press) ease-out hover:text-fg",
        className,
      )}
    >
      <span aria-hidden="true">←</span>
      <Logo className="h-[18px] w-auto" sizes="20px" />
      <span>LeMiu</span>
    </Link>
  );
}
