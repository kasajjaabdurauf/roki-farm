import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/layout";
import { PwaRegister } from "@/components/pwa";
import { AuthGate } from "@/components/auth";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

export const metadata: Metadata = {
  title: {
    default: "Roki — Farm & Supply Platform",
    template: "%s · Roki",
  },
  description:
    "Farmer registration surveys, production forecasting, export supply planning and rule-based validation for Roki Fruit & Vegetables Ltd — 1,000+ farmers in Uganda. Zero AI.",
  applicationName: "Roki",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Roki",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#1b4332",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Extend into the notch / rounded corners so the sticky header can pad
  // itself with env(safe-area-inset-*) in standalone PWA mode.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
        <PwaRegister />
      </body>
    </html>
  );
}
