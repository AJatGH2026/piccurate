import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuswahlBuddy — KI-gestützte Reisefoto-Auswahl",
  description:
    "Turn 1,000 vacation photos into 50 perfect memories. AI-powered selection, configurable criteria, instant download.",
};

// This root layout exists only to provide fonts + global CSS.
// The locale-specific layout at [locale]/layout.tsx adds <html lang> and i18n.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
