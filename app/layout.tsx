import type { Metadata } from "next";
import "./globals.css";

// Note: the original scaffold uses next/font/google (Geist), which needs
// network access to fonts.googleapis.com at build time. Using system fonts
// here only because this sandbox can't reach that domain -- on your machine
// the original next/font/google version works fine and is the better default.

export const metadata: Metadata = {
  title: "Math Platform",
  description: "Interactive, gamified math learning",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
