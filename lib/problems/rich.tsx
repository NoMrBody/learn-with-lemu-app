"use client";

import { Fragment, type ReactNode } from "react";
import { M } from "@/components/explainer/math";

/**
 * Renders the problem prose, which mixes three things the original handled
 * with innerHTML: plain text, `$…$` inline maths, and `<b>` emphasis.
 *
 * Parsed into React nodes rather than injected as HTML — the content is
 * ours, but prose and markup travel together here and a parser keeps the
 * door shut by construction. Only `<b>` and the two entities the content
 * actually uses are recognised; anything else stays literal text.
 */

const ENTITIES: Record<string, string> = {
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&amp;": "&",
  "&nbsp;": " ",
};

const decode = (s: string) =>
  s.replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);

/** Splits on `$…$`, rendering the maths through KaTeX. */
function withMath(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(decode(text.slice(last, m.index)));
    out.push(<M key={`${keyPrefix}-m${i++}`} tex={m[1]} />);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(decode(text.slice(last)));
  return out;
}

export function parseRich(src: string, keyPrefix = "r"): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /<b>([\s\S]*?)<\/b>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(...withMath(src.slice(last, m.index), `${keyPrefix}-${i}a`));
    // Emphasis normally lifts to the page's foreground, but a container
    // sitting on the figure's ground rather than the page's (the game's
    // toast) points --rich-strong at --fig-ink instead, so the bold text
    // matches the surface it is actually on.
    out.push(
      <b
        key={`${keyPrefix}-b${i}`}
        className="font-semibold"
        style={{ color: "var(--rich-strong, var(--lm-fg))" }}
      >
        {withMath(m[1], `${keyPrefix}-${i}b`)}
      </b>,
    );
    last = m.index + m[0].length;
    i++;
  }
  if (last < src.length) out.push(...withMath(src.slice(last), `${keyPrefix}-${i}z`));
  return out;
}

/** Convenience wrapper so callers can drop a string straight into JSX. */
export function Rich({ text, keyPrefix }: { text: string; keyPrefix?: string }) {
  return <Fragment>{parseRich(text, keyPrefix)}</Fragment>;
}
