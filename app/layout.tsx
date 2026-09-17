import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { UpdateBanner } from "@/components/shared/UpdateBanner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Qalqon — davomat va dalil tizimi",
    template: "%s · Qalqon",
  },
  description:
    "Nodavlat bog'chalar uchun mustaqil davomat va dalil tizimi. Davlat tizimi ishlamasa ham, sizda rasm, vaqt va imzo bilan tasdiqlangan dalil qoladi.",
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Qalqon",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uz" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <UpdateBanner />
        {children}
      </body>
    </html>
  );
}
