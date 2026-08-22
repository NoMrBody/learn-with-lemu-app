import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";

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
 * "← LeMiu" home link, used at the top of the pages that would otherwise be
 * dead ends. The arrow and wordmark stay: the mark on its own reads as
 * decoration, not as a way back.
 */
export function HomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-500 hover:text-foreground"
    >
      <span aria-hidden="true">←</span>
      <Logo className="h-[18px] w-auto" sizes="20px" />
      <span>LeMiu</span>
    </Link>
  );
}
