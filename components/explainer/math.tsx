"use client";

import katex from "katex";
import { useMemo } from "react";

/**
 * Inline KaTeX. The original walked the DOM for [data-tex] nodes and called
 * katex.render on each after every panel repaint; rendering to a string in a
 * memo does the same job without the walk.
 *
 * All TeX here is authored in this repo, never user input, and KaTeX escapes
 * its output by default (trust: false).
 */
export function M({ tex }: { tex: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { throwOnError: false, displayMode: false }),
    [tex],
  );
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
