// Root layout: fonts, AppShell wrapper. Spec: docs/frontend.md §1 (typography), §3.0 (shell).
import type { Metadata } from "next";
import { Noto_Sans, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const notoSans = Noto_Sans({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "G-VISTA — Gujarat Video Intelligence & Surveillance Technology Architecture",
  description:
    "Video-intelligence platform integrating CCTV infrastructure across Gujarat government departments for Gujarat Police.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${notoSans.variable} ${jetBrainsMono.variable}`}>
      <body data-font-step="1">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
