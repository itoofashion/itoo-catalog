import type { Metadata } from "next";
import { Jost } from "next/font/google";
import "./globals.css";

const sans = Jost({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "itoo — Wholesale Catalog",
  description: "Current styles, prices and photos from itoo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
