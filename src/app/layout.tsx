import type { Metadata, Viewport } from "next";
import { Archivo_Black, Nunito } from "next/font/google";
import "./globals.css";

const archivo = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Keep The Fire Light",
  description:
    "A daily ritual for family and friends: solve the word, stoke the shared campfire, leave a note.",
  icons: { icon: "/art/logo.png", apple: "/art/logo.png" },
  appleWebApp: { capable: true, title: "Keep The Fire Light", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e5dac0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
