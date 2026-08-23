"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Light/dark plumbing.
 *
 * `class` rather than the data-attribute strategy because globals.css keys
 * its dark variant off `.dark` — see the @custom-variant there.
 *
 * `disableTransitionOnChange` matters more here than in most apps: the token
 * layer transitions colours on hundreds of elements, and without this the
 * whole page cross-fades for 200ms every time the toggle is pressed, which
 * reads as lag rather than polish.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
