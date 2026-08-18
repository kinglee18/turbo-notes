import type { Metadata, Viewport } from "next";
import { Fraunces, Nunito_Sans } from "next/font/google";

import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const nunito = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Turbo Notes",
  description: "A cozy place for your charming notes.",
};

/**
 * Next already emits `width=device-width, initial-scale=1` by default, so this
 * exists for `interactiveWidget`: the editor is sized in dvh, and the default
 * `resizes-visual` leaves the layout viewport at full height when the soft
 * keyboard opens, hiding the caret behind it. `resizes-content` shrinks the
 * layout viewport instead, so dvh follows the keyboard.
 *
 * Deliberately no `maximumScale`/`userScalable`: blocking pinch-zoom fails
 * WCAG 1.4.4.
 */
export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
  themeColor: "#faf0e0", // --color-paper
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${nunito.variable}`}>
      <body className="min-h-dvh">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
